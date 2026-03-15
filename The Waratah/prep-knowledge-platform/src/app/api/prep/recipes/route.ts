import { NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appfcy14ZikhKZnRS';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableListAll(table: string, fields: string[]): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const fieldsQuery = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join('&');
    const offsetQuery = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${fieldsQuery}${offsetQuery}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      cache: 'no-store', // Ensure fresh data
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Airtable API error for ${table}:`, res.status, errorText);
      throw new Error(`Airtable API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

export async function GET() {
  try {
    // Check for API token
    if (!AIRTABLE_PAT) {
      console.error('AIRTABLE_PAT environment variable not set');
      return NextResponse.json(
        { error: 'Airtable API token not configured' },
        { status: 500 }
      );
    }

    // Waratah: recipe name comes from the linked 'Item Name' field (returns array of IDs).
    // Fetch all Items first so we can resolve IDs to names.
    const allItems = await airtableListAll('Items', ['Item Name']);
    const itemsById: Record<string, string> = {};
    for (const item of allItems) {
      itemsById[item.id] = String(item.fields['Item Name'] || '');
    }

    const recipes = await airtableListAll('Recipes', ['Item Name', 'Yield Qty']);

    console.log(`Fetched ${recipes.length} recipes from Airtable`);

    // Format for dropdown — resolve name via linked Item ID
    const formattedRecipes = recipes
      .map((r) => {
        const itemNameField = r.fields['Item Name'];
        const linkedItemId = Array.isArray(itemNameField) ? (itemNameField[0] as string) : null;
        const name = linkedItemId ? itemsById[linkedItemId] : '';
        return { id: r.id, name };
      })
      .filter((r) => r.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Returning ${formattedRecipes.length} Waratah recipes`);

    return NextResponse.json({ recipes: formattedRecipes });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Recipes fetch error:', errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch recipes: ${errorMessage}` },
      { status: 500 }
    );
  }
}
