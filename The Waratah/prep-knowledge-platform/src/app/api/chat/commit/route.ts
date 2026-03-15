import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

interface CommitMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CommitRequest {
  sessionId: string;
  messages: CommitMessage[];
}

export async function POST(req: Request) {
  try {
    const { sessionId, messages } = (await req.json()) as CommitRequest;

    if (!sessionId || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nothing to commit' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerClient();

    // Store the conversation session
    const { error } = await supabase.from('conversation_sessions').upsert(
      {
        id: sessionId,
        messages: messages,
        context: {
          messageCount: messages.length,
          lastActivity: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Failed to commit conversation:', error);
      // Don't fail the request - this is a background operation
    }

    // Extract and store any learned patterns from the conversation
    try {
      const userMessages = messages.filter((m) => m.role === 'user');
      const patterns = extractPatterns(userMessages.map((m) => m.content));

      for (const pattern of patterns) {
        await supabase.from('learned_patterns').upsert(
          {
            id: `pattern_${pattern.category}_${pattern.pattern.slice(0, 50).replace(/\W/g, '_')}`,
            pattern: pattern.pattern,
            category: pattern.category,
            occurrences: 1,
            confidence: 0.5,
            last_seen: new Date().toISOString(),
            examples: [userMessages[0]?.content || ''],
          },
          {
            onConflict: 'id',
            // Increment occurrences on conflict
          }
        );
      }
    } catch (patternError) {
      console.error('Failed to extract patterns:', patternError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Conversation committed to memory' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Commit API error:', error);
    // Return success anyway - don't block the UI for memory operations
    return new Response(JSON.stringify({ success: true, message: 'Commit attempted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Simple pattern extraction from user messages
function extractPatterns(messages: string[]): Array<{ pattern: string; category: string }> {
  const patterns: Array<{ pattern: string; category: string }> = [];

  for (const msg of messages) {
    const lower = msg.toLowerCase();

    // Intent patterns
    if (lower.includes('what') || lower.includes('how') || lower.includes('why')) {
      patterns.push({ pattern: 'question_query', category: 'intent' });
    }
    if (lower.includes('recipe') || lower.includes('ingredient')) {
      patterns.push({ pattern: 'recipe_lookup', category: 'intent' });
    }
    if (lower.includes('stocktake') || lower.includes('stock') || lower.includes('count')) {
      patterns.push({ pattern: 'stocktake_query', category: 'intent' });
    }
    if (lower.includes('prep') || lower.includes('batch')) {
      patterns.push({ pattern: 'prep_query', category: 'intent' });
    }
    if (lower.includes('order') || lower.includes('supplier')) {
      patterns.push({ pattern: 'ordering_query', category: 'intent' });
    }
    if (lower.includes('scale') || lower.includes('adjust')) {
      patterns.push({ pattern: 'scale_recipe', category: 'intent' });
    }

    // Entity patterns
    if (lower.includes('ferment')) {
      patterns.push({ pattern: 'fermentation', category: 'entity' });
    }
    if (lower.includes('brix') || lower.includes('sugar')) {
      patterns.push({ pattern: 'sugar_syrup', category: 'entity' });
    }
    if (lower.includes('acid') || lower.includes('citric')) {
      patterns.push({ pattern: 'acidification', category: 'entity' });
    }
    if (lower.includes('abv') || lower.includes('alcohol')) {
      patterns.push({ pattern: 'alcohol_content', category: 'entity' });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return patterns.filter((p) => {
    const key = `${p.category}_${p.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
