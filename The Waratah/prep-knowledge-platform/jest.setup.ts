import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.AIRTABLE_BASE_ID = 'appTestBaseId';
process.env.AIRTABLE_PAT = 'patTestToken';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock fetch globally
global.fetch = jest.fn();

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
