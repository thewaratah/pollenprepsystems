import { VenueConfig, VenueId } from '@/types/venue';

export const VENUES: Record<VenueId, VenueConfig> = {
  sakura: {
    id: 'sakura',
    name: 'sakura',
    displayName: 'Sakura House',
    airtableBaseId: process.env.SAKURA_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || 'appNsFRhuU47e9qlR',
    supabasePrefix: 'sakura_',
    slackWebhooks: {
      andie: process.env.SLACK_WEBHOOK_SAKURA_GOOCH || process.env.SLACK_WEBHOOK_GOOCH || '',
      blade: process.env.SLACK_WEBHOOK_SAKURA_SABS || process.env.SLACK_WEBHOOK_SABS || '',
      prep: process.env.SLACK_WEBHOOK_SAKURA_PREP || process.env.SLACK_WEBHOOK_PREP || '',
      test: process.env.SLACK_WEBHOOK_SAKURA_TEST || process.env.SLACK_WEBHOOK_EV_TEST || '',
    },
    driveFolderId: process.env.SAKURA_DOCS_FOLDER_ID || process.env.DOCS_FOLDER_ID || '',
    gasWebAppUrl: process.env.SAKURA_GAS_WEBAPP_URL || '',
    theme: {
      primaryColor: '#C41E3A',
      logo: '/logos/sakura.png',
    },
  },
  waratah: {
    id: 'waratah',
    name: 'waratah',
    displayName: 'The Waratah',
    airtableBaseId: process.env.WARATAH_AIRTABLE_BASE_ID || 'appfcy14ZikhKZnRS',
    supabasePrefix: 'waratah_',
    slackWebhooks: {
      andie: process.env.SLACK_WEBHOOK_WARATAH_ANDIE || '',
      blade: process.env.SLACK_WEBHOOK_WARATAH_BLADE || '',
      prep: process.env.SLACK_WEBHOOK_WARATAH_PREP || '',
      test: process.env.SLACK_WEBHOOK_WARATAH_TEST || '',
    },
    driveFolderId: process.env.WARATAH_DOCS_FOLDER_ID || '1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx',
    gasWebAppUrl: process.env.WARATAH_GAS_WEBAPP_URL || '',
    theme: {
      primaryColor: '#8B0000',
      logo: '/logos/waratah.png',
    },
  },
};

export function getVenue(venueId: VenueId): VenueConfig {
  const venue = VENUES[venueId];
  if (!venue) {
    throw new Error(`Unknown venue: ${venueId}`);
  }
  return venue;
}

export function getCurrentVenue(): VenueConfig {
  const venueId = (process.env.NEXT_PUBLIC_VENUE_ID || 'waratah') as VenueId;
  return getVenue(venueId);
}

export function getVenueFromRequest(headers?: Headers): VenueConfig {
  if (headers) {
    const venueId = (headers.get('x-venue-id') || process.env.NEXT_PUBLIC_VENUE_ID || 'waratah') as VenueId;
    return getVenue(venueId);
  }
  return getCurrentVenue();
}
