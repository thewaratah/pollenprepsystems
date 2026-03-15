/**
 * Shared types for prep list operations
 */

export interface PrepListSummary {
  total: number;
  completed: number;
  percent: number;
}

export interface OrderingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isCompleted: boolean;
}

export interface OrderingSupplier {
  name: string;
  items: OrderingItem[];
}

export interface OrderingListResult {
  type: 'ordering';
  prepRunId?: string;
  staff: string;
  suppliers: OrderingSupplier[];
  summary: PrepListSummary;
}

export interface BatchIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface BatchTask {
  id: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  notes: string;
  method: string;
  recipeId: string | null;
  ingredients: BatchIngredient[];
  isCompleted: boolean;
}

export interface BatchingListResult {
  type: 'batching';
  prepRunId?: string;
  tasks: BatchTask[];
  summary: PrepListSummary;
}

export interface SubRecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface SubRecipe {
  id: string;
  itemId: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  method: string;
  recipeId: string | null;
  ingredients: SubRecipeIngredient[];
  isCompleted: boolean;
}

export interface BatchWithSubRecipes {
  id: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  isCompleted: boolean;
  subRecipes: SubRecipe[];
}

export interface IngredientsListResult {
  type: 'ingredients';
  prepRunId?: string;
  batches: BatchWithSubRecipes[];
  summary: PrepListSummary;
}

export interface ItemData {
  name: string;
  unit: string;
  type: string;
}
