import { scaleRecipe } from '@/lib/airtable';

export const runtime = 'nodejs';

const WARATAH_BASE_ID = process.env.WARATAH_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

interface ScaleRequest {
  recipe: string;
  ingredient: string;
  quantity: number;
}

export async function POST(req: Request) {
  try {
    const { recipe, ingredient, quantity } = (await req.json()) as ScaleRequest;

    if (!recipe || !ingredient || quantity === undefined) {
      return Response.json(
        { error: 'Missing required fields: recipe, ingredient, quantity' },
        { status: 400 }
      );
    }

    const scaled = await scaleRecipe(WARATAH_BASE_ID, recipe, ingredient, quantity);

    if (!scaled) {
      return Response.json(
        { error: 'Recipe or ingredient not found' },
        { status: 404 }
      );
    }

    return Response.json(scaled);
  } catch (error) {
    console.error('Scale recipe error:', error);
    return Response.json(
      { error: 'Failed to scale recipe' },
      { status: 500 }
    );
  }
}
