import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appNsFRhuU47e9qlR';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetch(endpoint: string): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable error: ${res.status}`);
  }
  return res.json();
}

// Get latest prep run status
async function getLatestPrepRun(): Promise<{ id: string; label: string; date: string } | null> {
  try {
    const data = await airtableFetch(
      `${encodeURIComponent('Prep Runs')}?sort[0][field]=Run%20Date&sort[0][direction]=desc&maxRecords=1`
    );
    if (data.records.length > 0) {
      const r = data.records[0];
      return {
        id: r.id,
        label: String(r.fields['Label'] || r.fields['Run Date'] || 'Current'),
        date: String(r.fields['Run Date'] || ''),
      };
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Get stocktake summary
async function getStocktakeSummary(): Promise<string> {
  try {
    const data = await airtableFetch(
      `${encodeURIComponent('Weekly Counts')}?fields[]=Confirmed&maxRecords=1000`
    );
    const total = data.records.length;
    const confirmed = data.records.filter((r) => r.fields['Confirmed'] === true).length;
    const percent = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    return `Stocktake status: ${confirmed}/${total} items confirmed (${percent}%)`;
  } catch {
    return 'Unable to fetch stocktake status';
  }
}

// Get prep tasks summary
async function getPrepTasksSummary(): Promise<string> {
  try {
    const data = await airtableFetch(
      `${encodeURIComponent('Prep Tasks')}?fields[]=Completed&maxRecords=1000`
    );
    const total = data.records.length;
    const completed = data.records.filter((r) => r.fields['Completed'] === true).length;
    return `Prep tasks: ${completed}/${total} completed`;
  } catch {
    return 'Unable to fetch prep tasks';
  }
}

// Simple keyword-based response for when Claude API is not available
function getSimpleResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('stocktake') || lower.includes('stock') || lower.includes('count')) {
    return 'To check stocktake status, I would need to query the Weekly Counts table. You can also check the Dashboard for an overview.';
  }

  if (lower.includes('prep') && (lower.includes('task') || lower.includes('list'))) {
    return 'Prep tasks are generated from stocktake shortfalls. Check the Batching and Ingredients pages for current tasks.';
  }

  if (lower.includes('order') || lower.includes('ordering')) {
    return 'Ordering lists are available on the Ordering page, grouped by supplier. Andie and Blade have their own ordering responsibilities.';
  }

  if (lower.includes('recipe') || lower.includes('ingredient')) {
    return 'You can view recipe details and scale them using the Recipe Scaler. Look for the 📐 icon on batch items.';
  }

  if (lower.includes('feedback') || lower.includes('issue') || lower.includes('problem')) {
    return 'You can submit feedback using the feedback form. Look for "Have feedback? Submit here" links on each page.';
  }

  if (lower.includes('help') || lower.includes('what can')) {
    return 'I can help you with:\n• Stocktake status and progress\n• Prep tasks and batching\n• Ordering lists\n• Recipe information\n• Submitting feedback\n\nJust ask your question!';
  }

  return 'I\'m here to help with the prep system. You can ask about stocktake status, prep tasks, ordering, recipes, or general help with the system.';
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ response: 'Please enter a message.' });
    }

    // Try to use Claude API if available
    if (ANTHROPIC_API_KEY) {
      try {
        // Get context data
        const [prepRun, stocktake, prepTasks] = await Promise.all([
          getLatestPrepRun(),
          getStocktakeSummary(),
          getPrepTasksSummary(),
        ]);

        const systemPrompt = `You are the Prep Agent, an AI assistant for the PREP SYSTEM at The Waratah restaurant.

Current Status:
- ${prepRun ? `Latest prep run: ${prepRun.label} (${prepRun.date})` : 'No active prep run'}
- ${stocktake}
- ${prepTasks}

Your role:
- Answer questions about stocktake, prep tasks, ordering, and recipes
- Help staff navigate the prep system
- Provide concise, helpful responses
- Direct users to appropriate pages (Dashboard, Ordering, Batching, Ingredients, Scaler, Feedback)

Keep responses brief and actionable. Use the context data above to inform your answers.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 256,
            system: systemPrompt,
            messages: [{ role: 'user', content: message }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
          if (textContent?.text) {
            return NextResponse.json({ response: textContent.text });
          }
        }
      } catch {
        // Fall through to simple response
      }
    }

    // Fallback to simple keyword-based response
    const simpleResponse = getSimpleResponse(message);
    return NextResponse.json({ response: simpleResponse });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: 'Sorry, I encountered an error. Please try again.',
    });
  }
}
