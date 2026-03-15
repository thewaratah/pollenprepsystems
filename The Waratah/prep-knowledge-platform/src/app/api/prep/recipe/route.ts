import { lookupRecipe, listRecipes } from '@/lib/airtable';

export const runtime = 'nodejs';

const WARATAH_BASE_ID = process.env.WARATAH_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    const search = url.searchParams.get('search') || url.searchParams.get('q');

    // If search query, return list of matching recipes
    if (search) {
      const recipes = await listRecipes(WARATAH_BASE_ID, search);
      return Response.json({ recipes });
    }

    // If name provided, lookup specific recipe
    if (name) {
      const recipe = await lookupRecipe(WARATAH_BASE_ID, name);
      if (!recipe) {
        return Response.json({ error: 'Recipe not found' }, { status: 404 });
      }
      return Response.json(recipe);
    }

    // Otherwise return list of all recipes
    const recipes = await listRecipes(WARATAH_BASE_ID);
    return Response.json({ recipes });
  } catch (error) {
    console.error('Recipe lookup error:', error);
    return Response.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}
