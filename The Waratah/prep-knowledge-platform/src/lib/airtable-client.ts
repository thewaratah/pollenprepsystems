/**
 * Reusable Airtable API client
 * Provides type-safe CRUD operations with pagination and batch support
 */

import { AirtableRecord } from './workflow/types';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';

if (!AIRTABLE_PAT) {
  console.warn('AIRTABLE_PAT environment variable is not set');
}

/**
 * Fetch all records from a table with automatic pagination
 */
export async function airtableListAll(
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
      throw new Error(`Airtable API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * Batch update records (up to 10 per request as per Airtable limits)
 */
export async function batchUpdate(
  baseId: string,
  table: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>
): Promise<void> {
  const batchSize = 10;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: batch }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to update ${table}: ${errorText}`);
    }
  }
}

/**
 * Batch create records (up to 10 per request as per Airtable limits)
 */
export async function batchCreate(
  baseId: string,
  table: string,
  records: Array<{ fields: Record<string, unknown> }>
): Promise<AirtableRecord[]> {
  const batchSize = 10;
  const created: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

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
      throw new Error(`Failed to create ${table}: ${errorText}`);
    }

    const data = await res.json();
    created.push(...data.records);
  }

  return created;
}

/**
 * Create a single record
 */
export async function createRecord(
  baseId: string,
  table: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create record in ${table}: ${errorText}`);
  }

  return await res.json();
}

/**
 * Delete a single record
 */
export async function deleteRecord(
  baseId: string,
  table: string,
  recordId: string
): Promise<void> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to delete record from ${table}: ${errorText}`);
  }
}

/**
 * Get a single record by ID
 */
export async function getRecord(
  baseId: string,
  table: string,
  recordId: string
): Promise<AirtableRecord> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get record from ${table}: ${errorText}`);
  }

  return await res.json();
}
