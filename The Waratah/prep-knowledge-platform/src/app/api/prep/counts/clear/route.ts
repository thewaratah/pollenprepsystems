import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appNsFRhuU47e9qlR';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableListAll(
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
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${fieldsQuery}${filterQuery}${offsetQuery}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function batchDelete(table: string, recordIds: string[]): Promise<void> {
  // Airtable allows max 10 records per delete request
  const batchSize = 10;

  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    const params = batch.map((id) => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${params}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to delete records: ${errorText}`);
    }
  }
}

async function batchCreate(
  table: string,
  records: Array<{ fields: Record<string, unknown> }>
): Promise<AirtableRecord[]> {
  // Airtable allows max 10 records per create request
  const batchSize = 10;
  const created: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: batch }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create records: ${errorText}`);
    }

    const data = await res.json();
    created.push(...data.records);
  }

  return created;
}

// POST: Clear weekly counts and create fresh placeholders
export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable API token not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const preserveVerified = body.preserveVerified === true;

    console.log('Starting clear weekly counts, preserveVerified:', preserveVerified);

    // Get all existing weekly counts
    const existingCounts = await airtableListAll('Weekly Counts', [
      'Item',
      'Confirmed',
      'Count Source',
    ]);

    console.log(`Found ${existingCounts.length} existing weekly count records`);

    // Determine which to delete
    let toDelete: string[] = [];
    let preserved = 0;

    if (preserveVerified) {
      // Only delete unconfirmed counts
      for (const count of existingCounts) {
        if (count.fields['Confirmed'] === true) {
          preserved++;
        } else {
          toDelete.push(count.id);
        }
      }
    } else {
      // Delete all counts
      toDelete = existingCounts.map((c) => c.id);
    }

    console.log(`Deleting ${toDelete.length} records, preserving ${preserved}`);

    // Delete records
    if (toDelete.length > 0) {
      await batchDelete('Weekly Counts', toDelete);
    }

    // Get all active items for placeholder creation
    const items = await airtableListAll(
      'Items',
      ['Item Name', 'Item Type', 'Active'],
      'AND({Active}=TRUE(), OR({Item Type}="Batch", {Item Type}="Sub Recipe", {Item Type}="Sub-recipe", {Item Type}="Garnish", {Item Type}="Other", {Item Type}="Ingredient"))'
    );

    console.log(`Found ${items.length} active items for placeholder creation`);

    // If we preserved some counts, don't create duplicates for those items
    let itemsNeedingPlaceholders = items;
    if (preserveVerified && preserved > 0) {
      // Get the preserved count item IDs
      const preservedItemIds = new Set(
        existingCounts
          .filter((c) => c.fields['Confirmed'] === true)
          .map((c) => (c.fields['Item'] as string[])?.[0])
          .filter(Boolean)
      );
      itemsNeedingPlaceholders = items.filter((item) => !preservedItemIds.has(item.id));
    }

    // Create placeholder records
    const now = new Date().toISOString();
    const placeholders = itemsNeedingPlaceholders.map((item) => ({
      fields: {
        Item: [item.id],
        'Stock Count': 0,
        'Count Date': now,
        'Count Source': 'Stocktake (Verified)',
        Confirmed: false,
      },
    }));

    console.log(`Creating ${placeholders.length} placeholder records`);

    if (placeholders.length > 0) {
      await batchCreate('Weekly Counts', placeholders);
    }

    return NextResponse.json({
      success: true,
      deletedCount: toDelete.length,
      preservedCount: preserved,
      createdCount: placeholders.length,
      message: `Cleared ${toDelete.length} counts, created ${placeholders.length} placeholders`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Clear counts error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
