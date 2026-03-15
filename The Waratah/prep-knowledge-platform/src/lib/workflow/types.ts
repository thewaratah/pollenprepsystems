/**
 * Shared types for PREP workflow operations
 */

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface WorkflowResult {
  step: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  details?: Record<string, unknown>;
}

export interface StocktakeData {
  countedItems: number;
  totalItems: number;
  coveragePercent: number;
  countDate: string;
}

export interface PrepRunData {
  prepRunId: string;
  prepWeek: string;
  tasksCreated: number;
  ingredientRequirementsCreated: number;
  shortfallItems: number;
}
