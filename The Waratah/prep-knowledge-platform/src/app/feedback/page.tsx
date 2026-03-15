'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface SearchResult {
  id: string;
  name: string;
}

interface FormConfig {
  feedbackTypes: string[];
  docTypes: string[];
  staffRoles: string[];
}

const DEFAULT_CONFIG: FormConfig = {
  feedbackTypes: ['Missing Data', 'Recipe Issue', 'Suggestion', 'Other'],
  docTypes: ['Ingredient Prep List', 'Batching List', 'Andie Ordering', 'Blade Ordering'],
  staffRoles: ['Prep Team', 'Ordering - Andie', 'Ordering - Blade', 'Manager', 'Other'],
};

function FeedbackForm() {
  const searchParams = useSearchParams();
  const prepRunId = searchParams.get('prepRunId') || '';
  const initialDocType = searchParams.get('docType') || '';
  const initialStaffRole = searchParams.get('staffRole') || '';

  const [config] = useState<FormConfig>(DEFAULT_CONFIG);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState(initialStaffRole);
  const [docType, setDocType] = useState(initialDocType);
  const [feedbackType, setFeedbackType] = useState('');
  const [description, setDescription] = useState('');

  const [itemQuery, setItemQuery] = useState('');
  const [itemResults, setItemResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const [recipeQuery, setRecipeQuery] = useState('');
  const [recipeResults, setRecipeResults] = useState<SearchResult[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<SearchResult | null>(null);
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    aiCategory?: string;
    aiSuggestion?: string;
  } | null>(null);

  // Debounced search for items
  const searchItems = useCallback(async (query: string) => {
    if (query.length < 2) {
      setItemResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/prep/search?type=items&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setItemResults(data.results || []);
      }
    } catch (err) {
      console.error('Item search failed:', err);
    }
  }, []);

  // Debounced search for recipes
  const searchRecipes = useCallback(async (query: string) => {
    if (query.length < 2) {
      setRecipeResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/prep/search?type=recipes&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setRecipeResults(data.results || []);
      }
    } catch (err) {
      console.error('Recipe search failed:', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchItems(itemQuery), 300);
    return () => clearTimeout(timer);
  }, [itemQuery, searchItems]);

  useEffect(() => {
    const timer = setTimeout(() => searchRecipes(recipeQuery), 300);
    return () => clearTimeout(timer);
  }, [recipeQuery, searchRecipes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!staffName.trim()) {
      setSubmitResult({ success: false, message: 'Please enter your name' });
      return;
    }
    if (!feedbackType) {
      setSubmitResult({ success: false, message: 'Please select a feedback type' });
      return;
    }
    if (!description.trim()) {
      setSubmitResult({ success: false, message: 'Please enter a description' });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch('/api/prep/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffName: staffName.trim(),
          staffRole,
          docType,
          feedbackType,
          description: description.trim(),
          prepRunId,
          itemReferenceId: selectedItem?.id,
          itemReferenceName: selectedItem?.name,
          recipeReferenceId: selectedRecipe?.id,
          recipeReferenceName: selectedRecipe?.name,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitResult({
          success: true,
          message: 'Feedback submitted successfully! Thank you.',
          aiCategory: data.aiCategory,
          aiSuggestion: data.aiSuggestion,
        });
        // Reset form
        setDescription('');
        setFeedbackType('');
        setSelectedItem(null);
        setSelectedRecipe(null);
        setItemQuery('');
        setRecipeQuery('');
      } else {
        setSubmitResult({
          success: false,
          message: data.error || 'Failed to submit feedback',
        });
      }
    } catch (err) {
      setSubmitResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
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
            style={{ color: '#4A5D23', fontFamily: 'var(--font-display)' }}
          >
            Submit Feedback
          </h1>
          <p className="text-sm mt-1" style={{ color: '#2D3A16' }}>
            Help us improve the prep system by sharing your feedback
          </p>
        </div>

        {/* Success/Error Message */}
        {submitResult && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              submitResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`font-medium ${
                submitResult.success ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {submitResult.message}
            </p>
            {submitResult.aiCategory && (
              <div className="mt-2 text-sm" style={{ color: '#1a1a1a' }}>
                <p><strong>Category:</strong> {submitResult.aiCategory}</p>
                {submitResult.aiSuggestion && (
                  <p className="mt-1"><strong>Suggestion:</strong> {submitResult.aiSuggestion}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#e5e5e5' }}>
            {/* Staff Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                style={{ borderColor: '#e5e5e5' }}
                placeholder="Enter your name"
              />
            </div>

            {/* Staff Role */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Your Role
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                style={{ borderColor: '#e5e5e5' }}
              >
                <option value="">Select your role</option>
                {config.staffRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Document Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                style={{ borderColor: '#e5e5e5' }}
              >
                <option value="">Select document</option>
                {config.docTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#e5e5e5' }}>
            {/* Feedback Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Feedback Type <span className="text-red-500">*</span>
              </label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                style={{ borderColor: '#e5e5e5' }}
              >
                <option value="">Select type</option>
                {config.feedbackTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                style={{ borderColor: '#e5e5e5' }}
                placeholder="Describe the issue or suggestion..."
              />
            </div>

            {/* Item Reference (Autocomplete) */}
            <div className="mb-4 relative">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Related Item (optional)
              </label>
              {selectedItem ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg" style={{ borderColor: '#e5e5e5', backgroundColor: '#f5f4f0' }}>
                  <span>{selectedItem.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setItemQuery('');
                    }}
                    className="ml-auto text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={itemQuery}
                    onChange={(e) => {
                      setItemQuery(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                    style={{ borderColor: '#e5e5e5' }}
                    placeholder="Search for an item..."
                  />
                  {showItemDropdown && itemResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ borderColor: '#e5e5e5' }}>
                      {itemResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setItemQuery('');
                            setShowItemDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recipe Reference (Autocomplete) */}
            <div className="mb-4 relative">
              <label className="block text-sm font-medium mb-1" style={{ color: '#1a1a1a' }}>
                Related Recipe (optional)
              </label>
              {selectedRecipe ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg" style={{ borderColor: '#e5e5e5', backgroundColor: '#f5f4f0' }}>
                  <span>{selectedRecipe.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipe(null);
                      setRecipeQuery('');
                    }}
                    className="ml-auto text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={recipeQuery}
                    onChange={(e) => {
                      setRecipeQuery(e.target.value);
                      setShowRecipeDropdown(true);
                    }}
                    onFocus={() => setShowRecipeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowRecipeDropdown(false), 200)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A5D23] focus:border-[#4A5D23]"
                    style={{ borderColor: '#e5e5e5' }}
                    placeholder="Search for a recipe..."
                  />
                  {showRecipeDropdown && recipeResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ borderColor: '#e5e5e5' }}>
                      {recipeResults.map((recipe) => (
                        <button
                          key={recipe.id}
                          type="button"
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setRecipeQuery('');
                            setShowRecipeDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100"
                        >
                          {recipe.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#4A5D23' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}

function FeedbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f4f0' }}>
      <div className="animate-pulse text-gray-500">Loading...</div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackLoading />}>
      <FeedbackForm />
    </Suspense>
  );
}
