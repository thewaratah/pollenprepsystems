/**
 * Prep Lists API - Base Route
 *
 * PATCH: Update item completion status
 *
 * For GET operations, use the specific endpoints:
 * - GET /api/prep/lists/ordering?staff=andie|blade
 * - GET /api/prep/lists/batching
 * - GET /api/prep/lists/ingredients
 */

import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appNsFRhuU47e9qlR';
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

/**
 * PATCH: Update item completion status
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'AIRTABLE_PAT not configured' },
        { status: 500 }
      );
    }

    const { id, table, completed } = await req.json();

    if (!id || !table) {
      return NextResponse.json({ error: 'Missing id or table' }, { status: 400 });
    }

    const tableName = table === 'tasks' ? 'Prep%20Tasks' : 'Ingredient%20Requirements';

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: { Completed: completed },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable update failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Redirect to specific list endpoint
 */
export async function GET(req: NextRequest) {
  const listType = req.nextUrl.searchParams.get('type') || 'ordering';
  const staff = req.nextUrl.searchParams.get('staff');

  let redirectUrl;
  if (listType === 'ordering') {
    redirectUrl = `/api/prep/lists/ordering${staff ? `?staff=${staff}` : ''}`;
  } else if (listType === 'batching') {
    redirectUrl = `/api/prep/lists/batching`;
  } else if (listType === 'ingredients') {
    redirectUrl = `/api/prep/lists/ingredients`;
  } else {
    return NextResponse.json({ error: 'Invalid list type' }, { status: 400 });
  }

  return NextResponse.redirect(new URL(redirectUrl, req.url));
}
