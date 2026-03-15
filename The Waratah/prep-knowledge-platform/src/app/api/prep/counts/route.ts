import { NextRequest, NextResponse } from 'next/server';
import { getAirtableBaseIdFromRequest } from '@/lib/api-venue';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

async function airtableListAll(
  baseId: string,
  table: string,
  fields: string[],
  filterFormula?: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const fieldsQuery = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join('&');
    const filterQuery = filterFormula ? `&filterByFormula=${encodeURIComponent(filterFormula)}` : '';
    const offsetQuery = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${fieldsQuery}${filterQuery}${offsetQuery}`;

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

// GET: Fetch all active items with their current weekly counts
export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable API token not configured' },
        { status: 500 }
      );
    }

    // Extract venue-specific base ID from request
    const baseId = getAirtableBaseIdFromRequest(request);

    // Fetch all active items of relevant types
    const items = await airtableListAll(
      baseId,
      'Items',
      ['Item Name', 'Item Type', 'Unit', 'Active'],
      'AND({Active}=TRUE(), OR({Item Type}="Batch", {Item Type}="Sub Recipe", {Item Type}="Sub-recipe", {Item Type}="Garnish", {Item Type}="Other", {Item Type}="Ingredient"))'
    );

    // Fetch all unconfirmed weekly counts
    const counts = await airtableListAll(
      baseId,
      'Weekly Counts',
      ['Item', 'Stock Count', 'Count Date', 'Confirmed', 'Count Source'],
      '{Confirmed}=FALSE()'
    );

    // Build a map of item ID to count record
    const countsByItemId: Record<string, AirtableRecord> = {};
    for (const count of counts) {
      const itemIds = count.fields['Item'] as string[] | undefined;
      if (itemIds && itemIds[0]) {
        countsByItemId[itemIds[0]] = count;
      }
    }

    // Build response with items and their counts
    const itemsWithCounts = items
      .map((item) => {
        const countRecord = countsByItemId[item.id];
        const stockCount = countRecord?.fields['Stock Count'] as number | undefined;

        return {
          id: item.id,
          countId: countRecord?.id || null,
          name: (item.fields['Item Name'] as string) || 'Unknown',
          type: (item.fields['Item Type'] as string) || 'Other',
          unit: (item.fields['Unit'] as string) || '',
          stockCount: stockCount !== undefined ? stockCount : null,
          confirmed: (countRecord?.fields['Confirmed'] as boolean) || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary
    const total = itemsWithCounts.length;
    const counted = itemsWithCounts.filter((i) => i.stockCount !== null).length;
    const coveragePercent = total > 0 ? Math.round((counted / total) * 100) : 0;

    return NextResponse.json({
      items: itemsWithCounts,
      summary: {
        total,
        counted,
        coveragePercent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Counts fetch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update a single item's stock count (upsert)
export async function PATCH(request: NextRequest) {
  try {
    if (!AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable API token not configured' },
        { status: 500 }
      );
    }

    // Extract venue-specific base ID from request
    const baseId = getAirtableBaseIdFromRequest(request);

    const body = await request.json();
    const { itemId, stockCount } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    if (stockCount === undefined || stockCount === null) {
      return NextResponse.json({ error: 'stockCount is required' }, { status: 400 });
    }

    // Check if there's an existing unconfirmed count for this item
    const existingCounts = await airtableListAll(
      baseId,
      'Weekly Counts',
      ['Item', 'Stock Count'],
      `AND({Confirmed}=FALSE(), RECORD_ID()!="")`
    );

    const existingCount = existingCounts.find((c) => {
      const itemIds = c.fields['Item'] as string[] | undefined;
      return itemIds && itemIds[0] === itemId;
    });

    const now = new Date().toISOString();

    if (existingCount) {
      // Update existing record
      const updateUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent('Weekly Counts')}/${existingCount.id}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Stock Count': stockCount,
            'Count Date': now,
          },
        }),
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        throw new Error(`Failed to update count: ${errorText}`);
      }

      const updated = await updateRes.json();
      return NextResponse.json({
        success: true,
        action: 'updated',
        recordId: updated.id,
      });
    } else {
      // Create new record
      const createUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent('Weekly Counts')}`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Item: [itemId],
            'Stock Count': stockCount,
            'Count Date': now,
            'Count Source': 'Stocktake (Verified)',
            Confirmed: false,
          },
        }),
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        throw new Error(`Failed to create count: ${errorText}`);
      }

      const created = await createRes.json();
      return NextResponse.json({
        success: true,
        action: 'created',
        recordId: created.id,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Count update error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
