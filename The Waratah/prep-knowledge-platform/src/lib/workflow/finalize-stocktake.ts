/**
 * Finalize Stocktake Workflow
 *
 * Validates and confirms weekly stocktake counts:
 * - Finds all unconfirmed counts
 * - Validates all have stock count values
 * - Sets Confirmed = true
 * - Updates Count Source to "Stocktake (Verified)"
 * - Normalizes Count Date to current timestamp
 */

import { airtableListAll, batchUpdate } from '../airtable-client';
import { WorkflowResult } from './types';

export async function finalizeStocktake(baseId: string): Promise<WorkflowResult> {
  // Find unconfirmed counts
  const unconfirmedCounts = await airtableListAll(
    baseId,
    'Weekly Counts',
    ['Item', 'Stock Count', 'Count Date', 'Confirmed', 'Count Source'],
    '{Confirmed}=FALSE()'
  );

  if (unconfirmedCounts.length === 0) {
    return {
      step: 'finalize',
      status: 'skipped',
      message: 'No unconfirmed counts found - stocktake may already be finalized',
    };
  }

  // Validate all counts have values
  const missingCounts = unconfirmedCounts.filter(
    (c) => c.fields['Stock Count'] === undefined || c.fields['Stock Count'] === null
  );

  if (missingCounts.length > 0) {
    return {
      step: 'finalize',
      status: 'error',
      message: `${missingCounts.length} items have missing stock counts`,
      details: { missingCount: missingCounts.length },
    };
  }

  // Update all to Confirmed = true
  const now = new Date().toISOString();
  const updates = unconfirmedCounts.map((c) => ({
    id: c.id,
    fields: {
      Confirmed: true,
      'Count Source': 'Stocktake (Verified)',
      'Count Date': now,
    },
  }));

  await batchUpdate(baseId, 'Weekly Counts', updates);

  return {
    step: 'finalize',
    status: 'success',
    message: `Finalized ${unconfirmedCounts.length} stocktake counts`,
    details: { count: unconfirmedCounts.length },
  };
}
