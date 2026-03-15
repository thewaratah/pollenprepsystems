import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appfcy14ZikhKZnRS';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetch(endpoint: string): Promise<AirtableRecord | { records: AirtableRecord[]; offset?: string }> {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable error: ${res.status}`);
  }
  return res.json();
}

async function airtableListAll(table: string, fields: string[], filterFormula?: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const fieldsQuery = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join('&');
    const filterQuery = filterFormula ? `&filterByFormula=${encodeURIComponent(filterFormula)}` : '';
    const offsetQuery = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${fieldsQuery}${filterQuery}${offsetQuery}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      cache: 'no-store',
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for API token
    if (!AIRTABLE_PAT) {
      console.error('AIRTABLE_PAT environment variable not set');
      return NextResponse.json(
        { error: 'Airtable API token not configured' },
        { status: 500 }
      );
    }

    const { id } = await params;

    // Fetch recipe details
    const recipe = (await airtableFetch(
      `${encodeURIComponent('Recipes')}/${id}`
    )) as AirtableRecord;

    // Waratah: 'Item Name' is a linked record field (returns array of IDs), not a plain text field.
    // Name and yield unit are resolved below, after items are fetched.
    const itemNameField = recipe.fields['Item Name'];
    const linkedItemId = Array.isArray(itemNameField) ? (itemNameField[0] as string) : null;

    const yieldQty = Number(recipe.fields['Yield Qty']) || 1;
    const method = recipe.fields['Method'] ? String(recipe.fields['Method']) : undefined;

    // Fetch ALL recipe lines (filter in code - more reliable than FIND formula)
    const allRecipeLines = await airtableListAll(
      'Recipe Lines',
      ['Recipe', 'Item', 'Qty', 'Unit']
    );

    // Filter to lines for this recipe
    const recipeLines = allRecipeLines.filter((line) => {
      const linkedRecipes = line.fields['Recipe'] as string[] | undefined;
      return linkedRecipes && linkedRecipes.includes(id);
    });

    console.log(`Found ${recipeLines.length} recipe lines for recipe ${id}`);

    // Get item IDs from recipe lines
    const itemIds = new Set<string>();
    for (const line of recipeLines) {
      const items = line.fields['Item'];
      if (Array.isArray(items)) {
        items.forEach((itemId) => itemIds.add(itemId));
      }
    }

    // Fetch all items at once (more efficient than individual fetches)
    const allItems = await airtableListAll('Items', ['Item Name', 'Unit']);
    const itemsById: Record<string, { name: string; unit: string }> = {};
    for (const item of allItems) {
      itemsById[item.id] = {
        name: String(item.fields['Item Name'] || 'Unknown'),
        unit: String(item.fields['Unit'] || ''),
      };
    }

    // Resolve recipe name and yield unit from linked Item
    const linkedItem = linkedItemId ? itemsById[linkedItemId] : null;
    const name = linkedItem?.name || 'Unknown Recipe';
    const yieldUnit = linkedItem?.unit || 'ml';

    // Build ingredients list
    const ingredients = recipeLines
      .map((line) => {
        const itemArray = line.fields['Item'] as string[] | undefined;
        const itemId = itemArray?.[0] || '';
        const itemInfo = itemsById[itemId];
        const qty = Number(line.fields['Qty']) || 0;
        // Use unit from recipe line if available, otherwise from item
        const lineUnit = line.fields['Unit'] ? String(line.fields['Unit']) : '';
        const unit = lineUnit || (itemInfo?.unit || '');

        return {
          id: line.id,
          name: itemInfo?.name || 'Unknown',
          quantity: qty,
          unit: unit,
        };
      })
      .filter((ing) => ing.quantity > 0); // Filter out zero-quantity ingredients

    return NextResponse.json({
      id: recipe.id,
      name,
      yieldQty,
      yieldUnit,
      method,
      ingredients,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Recipe fetch error:', errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch recipe: ${errorMessage}` },
      { status: 500 }
    );
  }
}
