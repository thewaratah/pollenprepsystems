import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { getSupabasePrefixFromRequest, getVenueFromRequest } from '@/lib/api-venue';
import {
  getStocktakeStatus,
  lookupRecipe,
  scaleRecipe,
  getLatestPrepRun,
  getPrepTasks,
  getOrderingLists,
  getItemDetails,
} from '@/lib/airtable';
export const runtime = 'nodejs';
export const maxDuration = 300;

// Airtable knowledge base (bibliographic references + tags)
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const KB_BASE_ID = 'appItKHSfH9ObETUO';
const KB_TABLE_ID = 'tblHRvqrnipROayhk'; // Textbooks & Peer Reviews

interface AirtableBibRecord {
  name: string;
  uiName: string;
  bibliographicRef: string;
  tags: string[];
  brief: string;
}

// Fetch bibliographic metadata from Airtable for a set of filenames
async function fetchBibliography(filenames: string[]): Promise<Record<string, AirtableBibRecord>> {
  if (!AIRTABLE_PAT || filenames.length === 0) return {};
  try {
    // Build OR filter for up to 20 filenames (deduped, with/without .pdf variants)
    const uniqueFilenames = [...new Set(filenames)].slice(0, 20);
    const conditions = uniqueFilenames.map(f => `{Name}="${f.replace(/"/g, '\\"')}"`);
    const formula = conditions.length === 1 ? conditions[0] : `OR(${conditions.join(',')})`;
    const fields = ['Name', 'UI Name', 'Bibliographic References', 'Tags Text copy', 'Document Brief'];
    const params = new URLSearchParams({
      filterByFormula: formula,
      ...Object.fromEntries(fields.map((f, i) => [`fields[${i}]`, f])),
    });
    const res = await fetch(`https://api.airtable.com/v0/${KB_BASE_ID}/${KB_TABLE_ID}?${params}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });
    if (!res.ok) return {};
    const data = await res.json() as { records: Array<{ fields: Record<string, unknown> }> };
    const result: Record<string, AirtableBibRecord> = {};
    for (const record of data.records || []) {
      const f = record.fields;
      const name = String(f['Name'] || '');
      const bibField = f['Bibliographic References'] as { value?: string; state?: string } | string | undefined;
      const bibValue = typeof bibField === 'object' && bibField !== null
        ? (bibField.value || '')
        : String(bibField || '');
      const brief = f['Document Brief'] as { value?: string } | string | undefined;
      const briefValue = typeof brief === 'object' && brief !== null
        ? (brief.value || '')
        : String(brief || '');
      result[name] = {
        name,
        uiName: String(f['UI Name'] || name),
        bibliographicRef: bibValue.includes('No references') ? '' : bibValue,
        tags: Array.isArray(f['Tags Text copy']) ? (f['Tags Text copy'] as string[]) : [],
        brief: briefValue,
      };
    }
    return result;
  } catch {
    return {};
  }
}

// Search Airtable for documents matching a topic via tags
async function searchDocumentsByTopic(topic: string, limit = 10): Promise<Array<{
  name: string;
  uiName: string;
  tags: string[];
  brief: string;
  bibliographicRef: string;
}>> {
  if (!AIRTABLE_PAT) return [];
  try {
    // Search using contains on Tags Text (AI-generated free text field)
    const formula = `SEARCH(LOWER("${topic.toLowerCase().replace(/"/g, '')}"), LOWER({Tags Text}))`;
    const fields = ['Name', 'UI Name', 'Tags Text copy', 'Document Brief', 'Bibliographic References'];
    const params = new URLSearchParams({
      filterByFormula: formula,
      maxRecords: String(limit),
      ...Object.fromEntries(fields.map((f, i) => [`fields[${i}]`, f])),
    });
    const res = await fetch(`https://api.airtable.com/v0/${KB_BASE_ID}/${KB_TABLE_ID}?${params}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { records: Array<{ fields: Record<string, unknown> }> };
    return (data.records || []).map(record => {
      const f = record.fields;
      const bibField = f['Bibliographic References'] as { value?: string } | string | undefined;
      const bibValue = typeof bibField === 'object' && bibField !== null
        ? (bibField.value || '')
        : String(bibField || '');
      const brief = f['Document Brief'] as { value?: string } | string | undefined;
      const briefValue = typeof brief === 'object' && brief !== null
        ? (brief.value || '')
        : String(brief || '');
      return {
        name: String(f['Name'] || ''),
        uiName: String(f['UI Name'] || f['Name'] || ''),
        tags: Array.isArray(f['Tags Text copy']) ? (f['Tags Text copy'] as string[]) : [],
        brief: briefValue,
        bibliographicRef: bibValue.includes('No references') ? '' : bibValue,
      };
    });
  } catch {
    return [];
  }
}

// Memory is optional - loaded dynamically to avoid blocking on errors
let memoryModule: typeof import('@/lib/memory') | null = null;
let memoryFailed = false;

async function getMemoryManager() {
  if (memoryFailed) return null;
  if (memoryModule) return memoryModule.memoryManager;

  try {
    memoryModule = await import('@/lib/memory');
    await memoryModule.memoryManager.initialize();
    return memoryModule.memoryManager;
  } catch (error) {
    console.error('Memory manager unavailable:', error);
    memoryFailed = true;
    return null;
  }
}

// Generate a session ID from the request
function getSessionId(req: Request): string {
  // Use a header or generate a default
  const sessionHeader = req.headers.get('x-session-id');
  if (sessionHeader) return sessionHeader;

  // Fallback to a default session for now
  return 'default-session';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DocumentMatch {
  id: string;
  content: string;
  similarity: number;
  metadata: {
    document_id?: string;
    filename?: string;     // display name (title or raw filename)
    rawFilename?: string;  // raw file_name from rag_documents — used for Airtable lookup
    category?: string;
    chunk_index?: number;
    bibliographicRef?: string;
  };
}

// Search for relevant documents using vector similarity
// Uses match_documents() which JOINs rag_chunks with rag_documents and rag_categories
// to return full metadata (filename, title, category) alongside content.
// Falls back to the venue-prefixed function if match_documents returns nothing.
async function searchKnowledge(query: string, venuePrefix: string, limit = 8): Promise<DocumentMatch[]> {
  try {
    const supabase = createServerClient();
    const queryEmbedding = await generateEmbedding(query);

    // Primary search: match_documents has the full corpus with joined metadata
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: limit,
      match_threshold: 0.3,
    });

    if (!error && data && data.length > 0) {
      const chunks = (data as Array<{
        id: string;
        content: string;
        similarity: number;
        metadata: {
          filename?: string;
          title?: string;
          category?: string;
          chunk_index?: number;
          document_id?: string;
        };
      }>).map(doc => ({
        id: String(doc.id),
        content: doc.content,
        similarity: doc.similarity,
        metadata: {
          document_id: doc.metadata?.document_id,
          // filename: human-readable display name (title first, else raw filename)
          filename: doc.metadata?.title || doc.metadata?.filename || 'Knowledge Base',
          // rawFilename: exact file_name from rag_documents (matches Airtable Name field)
          rawFilename: doc.metadata?.filename,
          category: doc.metadata?.category,
          chunk_index: doc.metadata?.chunk_index,
        },
      }));

      // Enrich with bibliographic references from Airtable knowledge base
      // Use rawFilename for lookup (Airtable Name = raw file_name, may include .pdf extension)
      const lookupNames = chunks.flatMap(c => {
        const raw = c.metadata.rawFilename;
        if (!raw) return [];
        // Try both with and without .pdf extension
        return [raw, `${raw}.pdf`];
      }).filter(Boolean) as string[];

      const bibData = await fetchBibliography(lookupNames);

      return chunks.map(chunk => {
        const raw = chunk.metadata.rawFilename || '';
        // Match with or without extension
        const bib = bibData[raw] || bibData[`${raw}.pdf`];
        return {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            filename: bib?.uiName || chunk.metadata.filename,
            bibliographicRef: bib?.bibliographicRef || undefined,
          },
        };
      });
    }

    // Fallback: venue-specific table (waratah_rag_chunks / sakura_rag_chunks)
    const venueFunction = `${venuePrefix}match_chunks`;
    const documentsTable = `${venuePrefix}rag_documents`;

    const { data: venueData, error: venueError } = await supabase.rpc(venueFunction, {
      query_embedding: queryEmbedding,
      match_count: limit,
      match_threshold: 0.3,
    });

    if (venueError) {
      console.error(`Search error (${venueFunction}):`, venueError);
      return [];
    }

    const chunks = (venueData || []) as Array<{
      id: string;
      content: string;
      similarity: number;
      document_id?: string;
    }>;

    // Enrich fallback chunks with document titles (secondary lookup)
    const documentIds = [...new Set(chunks.map(c => c.document_id).filter(Boolean))] as string[];
    const documentMetadata: Record<string, { title: string; category: string }> = {};

    if (documentIds.length > 0) {
      const { data: docs } = await supabase
        .from(documentsTable)
        .select('id, title, category')
        .in('id', documentIds);

      if (docs) {
        (docs as Array<{ id: string; title: string; category: string }>).forEach(doc => {
          documentMetadata[doc.id] = { title: doc.title, category: doc.category };
        });
      }
    }

    return chunks.map(doc => {
      const docMeta = doc.document_id ? documentMetadata[doc.document_id] : undefined;
      return {
        id: doc.id,
        content: doc.content,
        similarity: doc.similarity,
        metadata: {
          document_id: doc.document_id,
          filename: docMeta?.title || 'Knowledge Base',
          category: docMeta?.category,
        },
      };
    });
  } catch (error) {
    console.error('Knowledge search failed:', error);
    return [];
  }
}

// Build context from retrieved documents
function buildContext(documents: DocumentMatch[]): string {
  if (documents.length === 0) {
    return '';
  }

  const contextParts = documents.map((doc, i) => {
    const title = doc.metadata?.filename || 'Knowledge Base';
    const category = doc.metadata?.category ? ` [${doc.metadata.category}]` : '';
    const pct = Math.round(doc.similarity * 100);
    // Use full bibliographic citation if available, otherwise just the title
    const citation = doc.metadata?.bibliographicRef
      ? `${doc.metadata.bibliographicRef}`
      : `${title}${category}`;
    return `[Source ${i + 1}: ${citation} — ${pct}% match]\n${doc.content}`;
  });

  return `\n\nRelevant knowledge from your database:\n\n${contextParts.join('\n\n---\n\n')}`;
}

// Define PREP operation tools (factory function to inject baseId)
function createPrepTools(baseId: string) {
  return {
    get_stocktake_status: tool({
      description: 'Get the current stocktake status including coverage percentage, counted items, and items remaining to count',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const status = await getStocktakeStatus(baseId);
          return {
            success: true,
            data: status,
            summary: `Stocktake is ${status.coveragePercent}% complete (${status.countedItems}/${status.totalItems} items). ${status.isReadyForFinalization ? 'Ready for finalization.' : `${status.uncountedItems.length} items still need counting.`}`,
          };
        } catch {
          return { success: false, error: 'Failed to fetch stocktake status' };
        }
      },
    }),

    lookup_recipe: tool({
      description: 'Look up a recipe by name to get its ingredients, quantities, and method',
      inputSchema: z.object({
        name: z.string().describe('The name or partial name of the recipe to look up'),
      }),
      execute: async ({ name }: { name: string }) => {
        try {
          const recipe = await lookupRecipe(baseId, name);
          if (!recipe) {
            return { success: false, error: `Recipe "${name}" not found` };
          }
          return {
            success: true,
            data: recipe,
            summary: `${recipe.name} yields ${recipe.yield} ${recipe.yieldUnit}. Has ${recipe.ingredients.length} ingredients.`,
          };
        } catch {
          return { success: false, error: 'Failed to look up recipe' };
        }
      },
    }),

    scale_recipe: tool({
      description: 'Scale a recipe based on a constraint ingredient. Enter the available quantity of one ingredient to calculate scaled amounts for all other ingredients.',
      inputSchema: z.object({
        recipe: z.string().describe('The name of the recipe to scale'),
        ingredient: z.string().describe('The name of the constraint ingredient you have available'),
        quantity: z.number().describe('The quantity of the constraint ingredient available'),
      }),
      execute: async ({ recipe, ingredient, quantity }: { recipe: string; ingredient: string; quantity: number }) => {
        try {
          const scaled = await scaleRecipe(baseId, recipe, ingredient, quantity);
          if (!scaled) {
            return { success: false, error: 'Recipe or ingredient not found' };
          }
          return {
            success: true,
            data: scaled,
            summary: `Scaled ${scaled.originalRecipe.name} by ${scaled.scaleFactor}x based on ${quantity} ${scaled.constraintIngredient}. New yield: ${scaled.scaledYield} ${scaled.originalRecipe.yieldUnit}.`,
          };
        } catch {
          return { success: false, error: 'Failed to scale recipe' };
        }
      },
    }),

    get_prep_status: tool({
      description: 'Get the current prep run status including tasks count and completion',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const prepRun = await getLatestPrepRun(baseId);
          if (!prepRun) {
            return { success: true, data: null, summary: 'No active prep run found.' };
          }
          const completionPercent = prepRun.tasksCount > 0
            ? Math.round((prepRun.completedTasks / prepRun.tasksCount) * 100)
            : 0;
          return {
            success: true,
            data: prepRun,
            summary: `Prep run "${prepRun.label}" is ${completionPercent}% complete (${prepRun.completedTasks}/${prepRun.tasksCount} tasks done).`,
          };
        } catch {
          return { success: false, error: 'Failed to fetch prep status' };
        }
      },
    }),

    get_prep_tasks: tool({
      description: 'Get the list of all prep tasks for the current prep run, including what needs to be made and batch quantities',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tasks = await getPrepTasks(baseId);
          if (tasks.length === 0) {
            return { success: true, data: [], summary: 'No prep tasks found for the current run.' };
          }
          const topTasks = tasks.slice(0, 5).map((t) => `${t.itemName} (${t.batchesNeeded} batches)`).join(', ');
          return {
            success: true,
            data: tasks,
            summary: `${tasks.length} prep tasks. Top items: ${topTasks}`,
          };
        } catch {
          return { success: false, error: 'Failed to fetch prep tasks' };
        }
      },
    }),

    get_ordering_list: tool({
      description: 'Get the ordering list showing what items need to be ordered, grouped by staff member (Andie, Blade, etc.)',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const lists = await getOrderingLists(baseId);
          if (lists.length === 0) {
            return { success: true, data: [], summary: 'No ordering requirements found.' };
          }
          const summary = lists.map((l) => `${l.staffName}: ${l.totalItems} items`).join(', ');
          return {
            success: true,
            data: lists,
            summary: `Ordering breakdown: ${summary}`,
          };
        } catch {
          return { success: false, error: 'Failed to fetch ordering list' };
        }
      },
    }),

    get_item_details: tool({
      description: 'Get detailed information about a specific item including par level, current stock, supplier, and type',
      inputSchema: z.object({
        name: z.string().describe('The name or partial name of the item to look up'),
      }),
      execute: async ({ name }: { name: string }) => {
        try {
          const item = await getItemDetails(baseId, name);
          if (!item) {
            return { success: false, error: `Item "${name}" not found` };
          }
          const stockStatus = item.currentStock !== null && item.parLevel !== null
            ? (item.currentStock >= item.parLevel ? 'sufficient' : 'below par')
            : 'unknown';
          return {
            success: true,
            data: item,
            summary: `${item.name} (${item.type}): Stock ${item.currentStock ?? 'N/A'} ${item.unit}, Par ${item.parLevel ?? 'N/A'}, Status: ${stockStatus}`,
          };
        } catch {
          return { success: false, error: 'Failed to fetch item details' };
        }
      },
    }),
  };
}

export async function POST(req: Request) {
  try {
    // Extract venue context from request
    const venue = getVenueFromRequest(req as never);
    const venuePrefix = getSupabasePrefixFromRequest(req as never);
    const baseId = venue.airtableBaseId;

    // Get memory manager (optional - may be null)
    const memory = await getMemoryManager();

    const sessionId = getSessionId(req);
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    // Get the latest user message for RAG
    const latestUserMessage = messages.filter((m) => m.role === 'user').pop();

    // Record user message in memory if available (async, don't block)
    if (memory && latestUserMessage) {
      memory.processMessage(sessionId, 'user', latestUserMessage.content).catch(console.error);
    }

    // Search for relevant documents (venue-specific knowledge base)
    let context = '';

    if (latestUserMessage) {
      const sources = await searchKnowledge(latestUserMessage.content, venuePrefix);
      context = buildContext(sources);
    }

    // Get enhanced context from memory if available
    let memoryContext = '';
    if (memory) {
      try {
        const enhanced = await memory.getEnhancedContext(
          sessionId,
          latestUserMessage?.content || ''
        );

        // Add learned patterns to context if any
        if (enhanced.topPatterns.length > 0) {
          const patternSummary = enhanced.topPatterns
            .map((p: { pattern: string; occurrences: number }) => `${p.pattern} (${p.occurrences}x)`)
            .join(', ');
          memoryContext = `\n\n**Learned Patterns:** ${patternSummary}`;
        }
      } catch (error) {
        console.error('Failed to get memory context:', error);
      }
    }

    // Build system prompt
    const systemPrompt = `You are PREP SUPER AGENT, the intelligent brain of ${venue.displayName} kitchen operations. You are powered by Claude Sonnet 4 with access to real-time operational data and a comprehensive knowledge base.

## Your Capabilities

**Real-Time Operations (use tools for current data):**
- get_stocktake_status: Check stocktake progress, coverage %, items remaining
- get_prep_status: Current prep run info and task counts
- get_prep_tasks: List all prep tasks with batch quantities
- get_ordering_list: Ordering requirements by staff (Andie, Blade)
- lookup_recipe: Get recipe details, ingredients, and method
- scale_recipe: Scale a recipe based on available ingredient quantity
- get_item_details: Item info including par level, stock, supplier

**Knowledge Base (87,000+ embedded documents):**
- Food science and chemistry (Maillard reaction, fermentation, preservation)
- Fermentation techniques (sauerkraut, kimchi, kombucha, kefir)
- Cocktail development and flavour theory
- Professional kitchen prep operations and SOPs
- Recipe scaling, ingredient management, and substitutions

**Knowledge Base Search by Topic:**
- search_documents_by_topic: Search the 2,500+ document library by topic/tag (e.g. "fermentation", "food safety", "maillard reaction"). Use this when the user asks a topic-specific question to surface the most relevant academic sources before answering.

**Web Search:**
- web_search: Search the internet for current information, research, supplier details, or anything not in your knowledge base

## How to Respond

1. **Use tools in this priority order:**
   - **Current operations** (stocktake, prep tasks, ordering, recipes, items) → call the relevant Airtable tool first.
   - **Food science, fermentation, chemistry, culinary technique, preservation, flavour, or ingredient questions** → ALWAYS call \`search_documents_by_topic\` FIRST, before web_search. The knowledge base has 2,500+ academic and professional documents on these topics. Only fall back to web_search if \`search_documents_by_topic\` returns no relevant results.
   - **Current events, supplier details, or information clearly not in the knowledge base** → use web_search.
2. **Always cite sources** - This is mandatory:
   - Knowledge base results: cite as **(Source: [document name])** inline after the relevant information
   - Web search results: cite the URL as **(Source: [url])** after each fact
   - Never present information from the knowledge base or web without a citation
3. **Be specific and actionable** - Give concrete numbers, item names, and next steps
4. **Offer follow-ups** - Suggest what the user might want to do next
5. **Be conversational** - You remember the full conversation context

## Response Style

- Write in plain, natural prose. Do not use markdown headers (#, ##), bold (**text**), or italics (*text*). Use plain text with clear paragraph breaks instead.
- Lists are fine where they genuinely help (e.g. numbered steps, ingredient quantities), but keep them short and unadorned.
- Never use em dashes. Use a comma, semicolon, or rewrite the sentence instead.
- Always write in British English (e.g. colour not color, flavour not flavor, pasteurised not pasteurized, organisation not organization).
- Keep responses focused but complete. For knowledge questions, explain the science plainly without jargon where possible.
${context}${memoryContext}

Answer based on your knowledge, the context provided, and tool results. Always use tools when asking about current operations.`;

    // Stream response with tool use (venue-specific tools)
    // Model can be configured via CLAUDE_MODEL env var
    const modelId = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    const result = streamText({
      model: anthropic(modelId),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: {
        ...createPrepTools(baseId),
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
        search_documents_by_topic: tool({
          description: 'Search the knowledge base by topic or subject area to find relevant academic and professional documents. ALWAYS call this FIRST for any food science, fermentation, preservation, chemistry, flavour, cocktail technique, or culinary question — before using web_search. Topics include: "fermentation", "food safety", "maillard reaction", "emulsification", "preservation", "pH", "antimicrobial", "cocktail", "sensory", etc.',
          inputSchema: z.object({
            topic: z.string().describe('The topic or subject to search for (e.g. "fermentation", "food safety", "pasteurization")'),
            limit: z.number().optional().describe('Maximum number of documents to return (default 8)'),
          }),
          execute: async ({ topic, limit = 8 }: { topic: string; limit?: number }) => {
            try {
              const docs = await searchDocumentsByTopic(topic, limit);
              if (docs.length === 0) {
                return { success: true, data: [], summary: `No documents found for topic "${topic}".` };
              }
              return {
                success: true,
                data: docs,
                summary: `Found ${docs.length} documents on "${topic}": ${docs.slice(0, 3).map(d => d.uiName || d.name).join(', ')}`,
              };
            } catch {
              return { success: false, error: 'Failed to search documents by topic' };
            }
          },
        }),
      },
      stopWhen: stepCountIs(10),
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
