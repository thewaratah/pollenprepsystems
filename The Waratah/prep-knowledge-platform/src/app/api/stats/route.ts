import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get total document count
    const { count: totalDocs } = await supabase
      .from('waratah_rag_documents')
      .select('*', { count: 'exact', head: true });

    // Get total chunk count
    const { count: totalChunks } = await supabase
      .from('waratah_rag_chunks')
      .select('*', { count: 'exact', head: true });

    // Get category breakdown
    const { data: categories } = await supabase
      .from('waratah_rag_categories')
      .select('name, id');

    // Get counts per category
    const categoryStats = await Promise.all(
      (categories || []).map(async (cat) => {
        const { count } = await supabase
          .from('waratah_rag_documents')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id);
        return { name: cat.name, count: count || 0 };
      })
    );

    return Response.json({
      totalDocuments: totalDocs || 0,
      totalChunks: totalChunks || 0,
      categories: categoryStats.filter((c) => c.count > 0),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return Response.json(
      {
        totalDocuments: 0,
        totalChunks: 0,
        categories: [],
        error: 'Failed to fetch stats',
      },
      { status: 500 }
    );
  }
}
