import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appNsFRhuU47e9qlR';

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const query = searchParams.get('q') || '';

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const queryLower = query.toLowerCase();
    const results: { id: string; name: string }[] = [];

    if (type === 'items') {
      // Fetch all items with pagination
      let offset: string | undefined;
      do {
        const offsetQuery = offset ? `&offset=${offset}` : '';
        const data = await airtableFetch(
          `${encodeURIComponent('Items')}?fields[]=Item%20Name&pageSize=100${offsetQuery}`
        );

        for (const record of data.records) {
          const name = record.fields['Item Name'];
          if (name && String(name).toLowerCase().includes(queryLower)) {
            results.push({ id: record.id, name: String(name) });
          }
        }

        offset = data.offset;
      } while (offset && results.length < 10);

      // Sort and limit
      results.sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ results: results.slice(0, 10) });
    }

    if (type === 'recipes') {
      // Fetch all recipes with pagination
      let offset: string | undefined;
      do {
        const offsetQuery = offset ? `&offset=${offset}` : '';
        const data = await airtableFetch(
          `${encodeURIComponent('Recipes')}?fields[]=Recipe%20Name&pageSize=100${offsetQuery}`
        );

        for (const record of data.records) {
          let name = record.fields['Recipe Name'];
          if (Array.isArray(name)) name = name[0];
          if (name && String(name).toLowerCase().includes(queryLower)) {
            results.push({ id: record.id, name: String(name) });
          }
        }

        offset = data.offset;
      } while (offset && results.length < 10);

      // Sort and limit
      results.sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ results: results.slice(0, 10) });
    }

    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
