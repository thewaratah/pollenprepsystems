import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appfcy14ZikhKZnRS'; // Waratah base

interface FeedbackData {
  staffName: string;
  staffRole?: string;
  docType?: string;
  feedbackType: string;
  description: string;
  prepRunId?: string;
  itemReferenceId?: string;
  itemReferenceName?: string;
  recipeReferenceId?: string;
  recipeReferenceName?: string;
}

// Simple AI triage based on feedback type and description
function triageFeedback(feedback: FeedbackData): {
  category: string;
  suggestion: string;
  confidence: number;
} {
  const description = (feedback.description || '').toLowerCase();
  const feedbackType = feedback.feedbackType || '';

  if (feedbackType === 'Missing Data') {
    if (description.includes('ingredient') || description.includes('missing') || description.includes('not found')) {
      return {
        category: 'Data Fix',
        confidence: 80,
        suggestion: 'Check Items table for the missing ingredient. May need to add a new item or update recipe linkages.',
      };
    }
    return {
      category: 'Data Fix',
      confidence: 75,
      suggestion: 'Review the data in Airtable. Check Items, Recipes, or Par Levels tables for missing information.',
    };
  }

  if (feedbackType === 'Recipe Issue') {
    if (description.includes('quantity') || description.includes('amount') || description.includes('wrong')) {
      return {
        category: 'Recipe Update',
        confidence: 85,
        suggestion: 'Review the Recipe Lines table for this recipe. Check quantities and ingredient linkages.',
      };
    }
    if (description.includes('method') || description.includes('step') || description.includes('instruction')) {
      return {
        category: 'Recipe Update',
        confidence: 80,
        suggestion: 'Review the recipe Method field in Recipes table. May need to update instructions.',
      };
    }
    return {
      category: 'Recipe Update',
      confidence: 75,
      suggestion: 'Review the recipe configuration in Recipes and Recipe Lines tables.',
    };
  }

  if (feedbackType === 'Suggestion') {
    return {
      category: 'General',
      confidence: 60,
      suggestion: 'Review suggestion for potential system improvement. Consider discussing in next prep planning meeting.',
    };
  }

  return {
    category: 'General',
    confidence: 40,
    suggestion: 'Review feedback and determine appropriate action.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const feedback: FeedbackData = await request.json();

    // Validate required fields
    if (!feedback.staffName?.trim()) {
      return NextResponse.json({ error: 'Please enter your name' }, { status: 400 });
    }
    if (!feedback.feedbackType) {
      return NextResponse.json({ error: 'Please select a feedback type' }, { status: 400 });
    }
    if (!feedback.description?.trim()) {
      return NextResponse.json({ error: 'Please enter a description' }, { status: 400 });
    }

    // Run AI triage
    const triage = triageFeedback(feedback);

    // Build Airtable fields
    const fields: Record<string, unknown> = {
      'Staff Name': feedback.staffName.trim(),
      'Feedback Type': feedback.feedbackType,
      'Description': feedback.description.trim(),
      'AI Category': triage.category,
      'AI Suggestion': triage.suggestion,
      'AI Confidence': triage.confidence,
      'Status': 'New',
    };

    if (feedback.staffRole) {
      fields['Staff Role'] = feedback.staffRole;
    }
    if (feedback.docType) {
      fields['Doc Type'] = feedback.docType;
    }
    if (feedback.prepRunId?.startsWith('rec')) {
      fields['Prep Run'] = [feedback.prepRunId];
    }
    if (feedback.itemReferenceId?.startsWith('rec')) {
      fields['Item Reference'] = [feedback.itemReferenceId];
    }
    if (feedback.recipeReferenceId?.startsWith('rec')) {
      fields['Recipe Reference'] = [feedback.recipeReferenceId];
    }

    // Create record in Airtable
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Feedback')}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!airtableRes.ok) {
      const errorText = await airtableRes.text();
      console.error('Airtable create failed:', errorText);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    const record = await airtableRes.json();

    return NextResponse.json({
      success: true,
      recordId: record.id,
      aiCategory: triage.category,
      aiSuggestion: triage.suggestion,
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
