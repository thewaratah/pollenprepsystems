/**
 * Prep Run Helper
 *
 * Shared utility for finding the latest prep run with data.
 */

import { airtableListAll } from '../airtable-client';
import { AirtableRecord } from '../workflow/types';

/**
 * Get the latest prep run that has tasks or requirements
 *
 * @param baseId - Airtable base ID
 * @returns Latest prep run record, or null if none found
 */
export async function getLatestPrepRun(baseId: string): Promise<AirtableRecord | null> {
  const runs = await airtableListAll(
    baseId,
    'Prep Runs',
    ['Prep Week', 'Prep Tasks', 'Ingredient Requirements'],
    undefined
  );

  if (!runs.length) return null;

  // Filter to runs that have data
  const withData = runs.filter((r) => {
    const tasks = r.fields['Prep Tasks'] as string[] | undefined;
    const reqs = r.fields['Ingredient Requirements'] as string[] | undefined;
    return (tasks?.length || 0) > 0 || (reqs?.length || 0) > 0;
  });

  const pool = withData.length ? withData : runs;
  pool.sort((a, b) =>
    new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime()
  );

  return pool[0] || null;
}
