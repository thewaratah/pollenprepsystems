'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  yieldQty: number;
  yieldUnit: string;
  method?: string;
  ingredients: Ingredient[];
}

const BUFFER_MULTIPLIER = 1.5;

function formatQty(qty: number, unit: string): string {
  const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  return `${qtyStr}${unit}`;
}

function ScalerContent() {
  const searchParams = useSearchParams();
  const recipeIdParam = searchParams.get('recipeId') || '';
  const recipeNameParam = searchParams.get('recipe') || '';

  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipeIdParam);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [constraintIngredientId, setConstraintIngredientId] = useState('');
  const [availableQty, setAvailableQty] = useState('');
  const [scaledRecipe, setScaledRecipe] = useState<{
    scaleFactor: number;
    scaledYield: number;
    ingredients: { name: string; originalQty: number; scaledQty: number; unit: string }[];
  } | null>(null);

  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesError, setRecipesError] = useState<string | null>(null);

  // Fetch recipe list
  useEffect(() => {
    async function fetchRecipes() {
      setRecipesLoading(true);
      setRecipesError(null);
      try {
        const res = await fetch('/api/prep/recipes');
        const data = await res.json();

        if (!res.ok) {
          setRecipesError(data.error || `API error: ${res.status}`);
          setRecipes([]);
          return;
        }

        const recipeList = data.recipes || [];
        setRecipes(recipeList);

        // If recipe name param provided, find matching recipe
        if (recipeNameParam && !recipeIdParam && recipeList.length > 0) {
          const match = recipeList.find((r: { name: string }) =>
            r.name.toLowerCase().includes(recipeNameParam.toLowerCase())
          );
          if (match) {
            setSelectedRecipeId(match.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch recipes:', err);
        setRecipesError('Network error: Could not connect to server');
        setRecipes([]);
      } finally {
        setRecipesLoading(false);
      }
    }
    fetchRecipes();
  }, [recipeNameParam, recipeIdParam]);

  // Fetch recipe details when selected
  useEffect(() => {
    if (!selectedRecipeId) {
      setRecipe(null);
      setScaledRecipe(null);
      return;
    }

    async function fetchRecipeDetails() {
      setLoading(true);
      setError(null);
      setScaledRecipe(null);
      setConstraintIngredientId('');
      setAvailableQty('');

      try {
        const res = await fetch(`/api/prep/recipes/${selectedRecipeId}`);
        if (res.ok) {
          const data = await res.json();
          setRecipe(data);
        } else {
          setError('Failed to load recipe details');
        }
      } catch (err) {
        setError('Network error loading recipe');
      } finally {
        setLoading(false);
      }
    }
    fetchRecipeDetails();
  }, [selectedRecipeId]);

  // Calculate scaled recipe
  const handleScale = () => {
    if (!recipe || !constraintIngredientId || !availableQty) return;

    const available = parseFloat(availableQty);
    if (isNaN(available) || available <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    const constraintIngredient = recipe.ingredients.find(
      (ing) => ing.id === constraintIngredientId
    );
    if (!constraintIngredient) return;

    // Calculate scale factor based on constraint
    const scaleFactor = available / constraintIngredient.quantity;
    const scaledYield = recipe.yieldQty * scaleFactor;

    // Scale all ingredients
    const scaledIngredients = recipe.ingredients.map((ing) => ({
      name: ing.name,
      originalQty: ing.quantity,
      scaledQty: ing.quantity * scaleFactor,
      unit: ing.unit,
    }));

    setScaledRecipe({
      scaleFactor,
      scaledYield,
      ingredients: scaledIngredients,
    });
    setError(null);
  };

  // Reset scaling
  const handleReset = () => {
    setScaledRecipe(null);
    setConstraintIngredientId('');
    setAvailableQty('');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f4f0' }}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/prep"
            className="text-sm mb-4 inline-block"
            style={{ color: '#007AFF' }}
          >
            ← Back to Dashboard
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#d85a3a', fontFamily: 'var(--font-display)' }}
          >
            📐 Recipe Scaler
          </h1>
          <p className="text-sm mt-1" style={{ color: '#2D3A16' }}>
            Scale recipes based on available ingredients
          </p>
        </div>

        {/* Recipe Selection */}
        <div className="bg-white rounded-lg border p-6 mb-6" style={{ borderColor: '#e5e5e5' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
            Select Recipe
          </label>
          {recipesLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full" />
              <span className="text-sm text-gray-500">Loading recipes...</span>
            </div>
          ) : recipesError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{recipesError}</p>
              <p className="text-xs text-red-500 mt-1">
                Check that AIRTABLE_PAT environment variable is set correctly.
              </p>
            </div>
          ) : recipes.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">No recipes found in Airtable.</p>
              <p className="text-xs text-yellow-600 mt-1">
                Make sure the Recipes table exists and has data.
              </p>
            </div>
          ) : (
            <select
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              style={{ borderColor: '#e5e5e5', color: '#1a1a1a', backgroundColor: '#fff' }}
            >
              <option value="">Choose a recipe...</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border p-6 mb-6" style={{ borderColor: '#e5e5e5' }}>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Recipe Details & Scaling */}
        {recipe && !loading && (
          <>
            {/* Original Recipe */}
            <div className="bg-white rounded-lg border p-6 mb-6" style={{ borderColor: '#e5e5e5' }}>
              <h2
                className="text-lg font-bold mb-2"
                style={{ color: '#d85a3a' }}
              >
                {recipe.name}
              </h2>
              <p className="text-sm mb-4" style={{ color: '#2D3A16' }}>
                Yield: <strong>{formatQty(recipe.yieldQty, recipe.yieldUnit)}</strong>
              </p>

              <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>
                Ingredients (Original)
              </h3>
              <ul className="space-y-1 mb-4">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="flex items-center gap-2 text-sm" style={{ color: '#1a1a1a' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4A5D23' }} />
                    <span>
                      <span className="font-medium">{ing.name}</span>{' '}
                      <span className="font-bold">{formatQty(ing.quantity, ing.unit)}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {recipe.method && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>
                    Method
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#1a1a1a' }}>
                    {recipe.method}
                  </p>
                </div>
              )}
            </div>

            {/* Scaling Controls */}
            <div className="bg-white rounded-lg border p-6 mb-6" style={{ borderColor: '#e5e5e5' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#1a1a1a' }}>
                Scale by Available Ingredient
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#2D3A16' }}>
                    Constraint Ingredient
                  </label>
                  <select
                    value={constraintIngredientId}
                    onChange={(e) => setConstraintIngredientId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    style={{ borderColor: '#e5e5e5', color: '#1a1a1a', backgroundColor: '#fff' }}
                  >
                    <option value="">Select ingredient...</option>
                    {recipe.ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({formatQty(ing.quantity, ing.unit)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: '#2D3A16' }}>
                    Available Quantity
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={availableQty}
                      onChange={(e) => setAvailableQty(e.target.value)}
                      placeholder="e.g., 100"
                      step="any"
                      min="0"
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      style={{ borderColor: '#e5e5e5', color: '#1a1a1a', backgroundColor: '#fff' }}
                    />
                    {constraintIngredientId && (
                      <span className="flex items-center px-2 text-sm" style={{ color: '#2D3A16' }}>
                        {recipe.ingredients.find((i) => i.id === constraintIngredientId)?.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleScale}
                  disabled={!constraintIngredientId || !availableQty}
                  className="flex-1 py-2 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#d85a3a' }}
                >
                  Calculate Scaled Recipe
                </button>
                {scaledRecipe && (
                  <button
                    onClick={handleReset}
                    className="py-2 px-4 rounded-lg font-medium border transition-colors"
                    style={{ borderColor: '#2D3A16', color: '#2D3A16' }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Scaled Recipe Result */}
            {scaledRecipe && (
              <div
                className="bg-white rounded-lg border p-6"
                style={{ borderColor: '#d85a3a', backgroundColor: '#fff8f6' }}
              >
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: '#d85a3a' }}
                >
                  Scaled Recipe
                </h3>
                <div className="flex flex-wrap gap-4 mb-4 text-sm">
                  <p>
                    <span style={{ color: '#2D3A16' }}>Scale Factor:</span>{' '}
                    <strong>{scaledRecipe.scaleFactor.toFixed(2)}×</strong>
                  </p>
                  <p>
                    <span style={{ color: '#2D3A16' }}>New Yield:</span>{' '}
                    <strong>{formatQty(scaledRecipe.scaledYield, recipe.yieldUnit)}</strong>
                  </p>
                  <p>
                    <span style={{ color: '#2D3A16' }}>With 1.5× Buffer:</span>{' '}
                    <strong>{formatQty(scaledRecipe.scaledYield * BUFFER_MULTIPLIER, recipe.yieldUnit)}</strong>
                  </p>
                </div>

                <h4 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>
                  Scaled Ingredients
                </h4>
                <ul className="space-y-2">
                  {scaledRecipe.ingredients.map((ing, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 rounded"
                      style={{ backgroundColor: 'white', color: '#1a1a1a' }}
                    >
                      <span className="font-medium">{ing.name}</span>
                      <span>
                        <span className="font-bold underline">{formatQty(ing.scaledQty, ing.unit)}</span>
                        <span style={{ color: '#2D3A16' }}>
                          {' '}(1.5× = {formatQty(ing.scaledQty * BUFFER_MULTIPLIER, ing.unit)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScalerLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f4f0' }}>
      <div className="animate-pulse text-gray-500">Loading...</div>
    </div>
  );
}

export default function ScalerPage() {
  return (
    <Suspense fallback={<ScalerLoading />}>
      <ScalerContent />
    </Suspense>
  );
}
