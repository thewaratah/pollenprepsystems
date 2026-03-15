import { NextRequest } from 'next/server';
import { VenueConfig, VenueId } from '@/types/venue';
import { getVenue } from '@/lib/venues';

/**
 * Extract venue context from API request
 *
 * Priority order:
 * 1. x-venue-id header
 * 2. venueId query parameter
 * 3. NEXT_PUBLIC_VENUE_ID environment variable
 * 4. Default to 'sakura'
 *
 * @param request - Next.js API request
 * @returns VenueConfig object
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const venue = getVenueFromRequest(request);
 *   console.log(`Using venue: ${venue.displayName}`);
 *   // ...
 * }
 * ```
 */
export function getVenueFromRequest(request: NextRequest): VenueConfig {
  // Check header first
  const headerVenue = request.headers.get('x-venue-id');
  if (headerVenue) {
    return getVenue(headerVenue as VenueId);
  }

  // Check query parameter
  const { searchParams } = new URL(request.url);
  const queryVenue = searchParams.get('venueId');
  if (queryVenue) {
    return getVenue(queryVenue as VenueId);
  }

  // Fall back to environment variable
  const envVenue = process.env.NEXT_PUBLIC_VENUE_ID || 'waratah';
  return getVenue(envVenue as VenueId);
}

/**
 * Extract venue ID string from request
 * Convenience method when you only need the ID
 */
export function getVenueIdFromRequest(request: NextRequest): VenueId {
  return getVenueFromRequest(request).id;
}

/**
 * Extract venue-specific Airtable base ID from request
 * Convenience method for Airtable API calls
 */
export function getAirtableBaseIdFromRequest(request: NextRequest): string {
  return getVenueFromRequest(request).airtableBaseId;
}

/**
 * Extract venue-specific Supabase table prefix from request
 * Convenience method for RAG queries
 *
 * @example
 * ```typescript
 * const prefix = getSupabasePrefixFromRequest(request);
 * // Returns: "sakura_" or "waratah_"
 * const tableName = `${prefix}rag_chunks`;
 * // Results in: "sakura_rag_chunks" or "waratah_rag_chunks"
 * ```
 */
export function getSupabasePrefixFromRequest(request: NextRequest): string {
  return getVenueFromRequest(request).supabasePrefix;
}
