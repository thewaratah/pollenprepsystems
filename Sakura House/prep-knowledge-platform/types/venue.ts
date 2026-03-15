export type VenueId = 'sakura' | 'waratah';

export interface VenueConfig {
  id: VenueId;
  name: string;
  displayName: string;
  airtableBaseId: string;
  supabasePrefix: string; // For RAG table namespacing
  slackWebhooks: {
    gooch: string;
    sabs: string;
    prep: string;
    test: string;
  };
  driveFolderId: string;
  gasWebAppUrl: string;
  theme: {
    primaryColor: string;
    logo: string;
  };
}
