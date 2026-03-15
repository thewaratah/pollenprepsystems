/**
 * Ordering List Builder
 *
 * Generates ordering lists grouped by supplier and filtered by staff.
 * Excludes Batch/Sub Recipe items (made in-house) and aggregates quantities for duplicate items.
 */

import { airtableListAll } from '../airtable-client';
import { AirtableRecord } from '../workflow/types';
import { OrderingListResult, ItemData } from './types';

/**
 * Build ordering list for specified staff member
 *
 * @param baseId - Airtable base ID
 * @param prepRunId - Prep run record ID (optional)
 * @param reqIds - Ingredient requirement IDs for this prep run
 * @param staffFilter - Filter by staff ('andie', 'blade', or null for all)
 * @returns Ordering list with suppliers and items
 */
export async function buildOrderingList(
  baseId: string,
  prepRunId: string | undefined,
  reqIds: string[],
  staffFilter: string | null
): Promise<OrderingListResult> {
  // Get ingredient requirements
  const allReqs = await airtableListAll(
    baseId,
    'Ingredient Requirements',
    ['Item Link', 'Total Qty Needed', 'Supplier Name (Static)', 'Ordering Staff (Static)'],
    undefined
  );

  // Filter to this prep run's requirements
  const requirements = reqIds.length > 0
    ? allReqs.filter(r => reqIds.includes(r.id))
    : allReqs;

  // Get item details
  const itemIds = new Set<string>();
  requirements.forEach((r) => {
    const links = r.fields['Item Link'] as string[] | undefined;
    if (links?.[0]) itemIds.add(links[0]);
  });

  // Fetch items with type info to filter out Batch and Sub Recipe types
  const itemData: Record<string, ItemData> = {};
  if (itemIds.size > 0) {
    const items = await airtableListAll(baseId, 'Items', ['Item Name', 'Unit', 'Item Type'], undefined);
    items.forEach((item) => {
      if (itemIds.has(item.id)) {
        itemData[item.id] = {
          name: (item.fields['Item Name'] as string) || 'Unknown',
          unit: (item.fields['Unit'] as string) || '',
          type: (item.fields['Item Type'] as string) || '',
        };
      }
    });
  }

  // Staff aliases for matching (Airtable field values for each staff member)
  const staffAliases: Record<string, string[]> = {
    andie: ['andie'],
    blade: ['blade'],
  };

  // Check if ordering staff matches the filter (with aliases)
  function staffMatches(orderingStaff: string, filter: string): boolean {
    const staffLower = orderingStaff.toLowerCase();
    const filterLower = filter.toLowerCase();

    // Check direct match
    if (staffLower.includes(filterLower)) return true;

    // Check aliases for the filter
    const aliases = staffAliases[filterLower];
    if (aliases) {
      return aliases.some(alias => staffLower.includes(alias));
    }

    return false;
  }

  // Group by supplier, then aggregate items by name within each supplier
  const supplierMap: Record<string, {
    name: string;
    itemsMap: Record<string, {
      ids: string[];
      name: string;
      quantity: number;
      unit: string;
    }>;
  }> = {};

  for (const req of requirements) {
    const supplierName = (req.fields['Supplier Name (Static)'] as string) || 'Unassigned';
    const orderingStaff = (req.fields['Ordering Staff (Static)'] as string) || '';
    const itemLink = (req.fields['Item Link'] as string[])?.[0];
    const qty = (req.fields['Total Qty Needed'] as number) || 0;

    // Skip items with no quantity
    if (qty <= 0) continue;

    // Skip Batch and Sub Recipe items (made in-house)
    const itemType = itemLink ? itemData[itemLink]?.type || '' : '';
    if (itemType === 'Batch' || itemType === 'Sub Recipe' || itemType === 'Sub-recipe') {
      continue;
    }

    // Skip in-house suppliers
    if (supplierName.toLowerCase().includes('in house')) continue;
    if (orderingStaff.toLowerCase().includes('in house')) continue;

    // Filter by staff if specified (with alias support)
    if (staffFilter && !staffMatches(orderingStaff, staffFilter)) {
      continue;
    }

    const itemName = itemLink ? itemData[itemLink]?.name || 'Unknown' : 'Unknown';
    const itemUnit = itemLink ? itemData[itemLink]?.unit || '' : '';

    if (!supplierMap[supplierName]) {
      supplierMap[supplierName] = { name: supplierName, itemsMap: {} };
    }

    // Aggregate by item name - combine quantities for same item
    const itemKey = `${itemName}|${itemUnit}`;
    if (!supplierMap[supplierName].itemsMap[itemKey]) {
      supplierMap[supplierName].itemsMap[itemKey] = {
        ids: [req.id],
        name: itemName,
        quantity: qty,
        unit: itemUnit,
      };
    } else {
      // Add to existing item's quantity
      supplierMap[supplierName].itemsMap[itemKey].quantity += qty;
      supplierMap[supplierName].itemsMap[itemKey].ids.push(req.id);
    }
  }

  // Convert itemsMap to items array and sort
  const suppliers = Object.values(supplierMap)
    .map(supplier => ({
      name: supplier.name,
      items: Object.values(supplier.itemsMap)
        .map(item => ({
          id: item.ids[0], // Use first ID for compatibility
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          isCompleted: false, // Completion is tracked at Prep Tasks level
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(s => s.items.length > 0)
    .sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return a.name.localeCompare(b.name);
    });

  // Calculate totals
  const totalItems = suppliers.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = suppliers.reduce(
    (sum, s) => sum + s.items.filter((i) => i.isCompleted).length,
    0
  );

  return {
    type: 'ordering',
    prepRunId,
    staff: staffFilter || 'all',
    suppliers,
    summary: {
      total: totalItems,
      completed: completedItems,
      percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    },
  };
}
