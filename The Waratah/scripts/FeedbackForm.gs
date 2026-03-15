/**
 * Feedback Form - Staff feedback collection for PREP SYSTEM documents
 *
 * Allows Andie, Blade, and prep team to submit feedback about:
 * - Missing data/ingredients
 * - Recipe issues (wrong quantities, missing steps)
 * - General suggestions
 *
 * Features:
 * - AI triage to categorize and suggest actions
 * - Slack notifications to admin
 * - Airtable logging for tracking
 *
 * @version 1.0
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const FEEDBACK_CONFIG = {
  airtable: {
    baseId: null, // From Script Properties
    tables: {
      feedback: 'Feedback',
      items: 'Items',
      recipes: 'Recipes',
      recipeLines: 'Recipe Lines',
      prepRuns: 'Prep Runs'
    }
  },
  feedbackTypes: ['Missing Data', 'Recipe Issue', 'Suggestion', 'Other'],
  docTypes: ['Ingredient Prep List', 'Batching List', 'Andie Ordering', 'Blade Ordering'],
  staffRoles: ['Prep Team', 'Ordering - Andie', 'Ordering - Blade', 'Manager', 'Other'],
  aiCategories: ['Data Fix', 'Recipe Update', 'General'],
  timeZone: 'Australia/Sydney'
};

// =============================================================================
// WEB APP ENTRY POINTS
// =============================================================================

/**
 * Serves the Feedback Form HTML page
 * Accepts URL parameters: prepRunId, docType, staffRole
 * Called by the unified doGet router in GoogleDocsPrepSystem.gs
 */
function doGetFeedback(e) {
  const prepRunId = e.parameter.prepRunId || '';
  const docType = e.parameter.docType || '';
  const staffRole = e.parameter.staffRole || '';

  const template = HtmlService.createTemplateFromFile('FeedbackFormUI');
  template.prepRunId = prepRunId;
  template.docType = docType;
  template.staffRole = staffRole;

  return template.evaluate()
    .setTitle('Prep Feedback')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML files (for modular templates)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =============================================================================
// API FUNCTIONS (called from client-side via google.script.run)
// =============================================================================

/**
 * Get configuration data for the form (doc types, feedback types, etc.)
 */
function getFormConfig() {
  return {
    feedbackTypes: FEEDBACK_CONFIG.feedbackTypes,
    docTypes: FEEDBACK_CONFIG.docTypes,
    staffRoles: FEEDBACK_CONFIG.staffRoles
  };
}

/**
 * Get prep run details for context display
 */
function getPrepRunDetails(prepRunId) {
  if (!prepRunId || !prepRunId.startsWith('rec')) {
    return null;
  }

  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  if (!baseId || !pat) {
    throw new Error('Airtable credentials not configured');
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.prepRuns)}/${prepRunId}`;
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return null;
    }

    const record = JSON.parse(response.getContentText());
    return {
      id: record.id,
      label: record.fields['Label'] || record.fields['Run Date'] || 'Unknown',
      date: record.fields['Run Date'] || null
    };
  } catch (e) {
    Logger.log('Error fetching prep run: ' + e.message);
    return null;
  }
}

/**
 * Search items for autocomplete (partial match)
 */
function searchItems(query) {
  if (!query || query.length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase();

  const allItems = airtableListAll_(FEEDBACK_CONFIG.airtable.tables.items, {
    fields: ['Item Name'],
    pageSize: 100
  });

  // Filter and map
  const matches = allItems
    .filter(r => {
      const name = r.fields['Item Name'];
      if (!name) return false;
      return String(name).toLowerCase().includes(queryLower);
    })
    .map(r => ({
      id: r.id,
      name: String(r.fields['Item Name'])
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10); // Limit to 10 results

  return matches;
}

/**
 * Search recipes for autocomplete (partial match)
 */
function searchRecipes(query) {
  if (!query || query.length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase();

  // Waratah Recipes table uses 'Item Name' (linked record to Items), not 'Recipe Name' (plain text).
  // Step 1: Build id → name map from active Items
  const activeItemsById = {};
  for (const item of airtableListAll_(FEEDBACK_CONFIG.airtable.tables.items, {
    fields: ['Item Name'],
    filterByFormula: '{Status}="Active"',
    pageSize: 100
  })) {
    activeItemsById[item.id] = item.fields['Item Name'] || null;
  }

  // Step 2: Fetch all recipes
  const allRecipes = airtableListAll_(FEEDBACK_CONFIG.airtable.tables.recipes, {
    fields: ['Item Name'],
    pageSize: 100
  });

  // Step 3: Resolve name via linked Item ID, filter by query
  const matches = [];
  for (const r of allRecipes) {
    const itemNameField = r.fields['Item Name'];
    let linkedItemId = null;
    if (Array.isArray(itemNameField) && itemNameField.length > 0) {
      const first = itemNameField[0];
      linkedItemId = typeof first === 'string' ? first : (first && first.id ? first.id : null);
    }
    const name = linkedItemId ? activeItemsById[linkedItemId] : null;
    if (!name) continue;
    if (!String(name).toLowerCase().includes(queryLower)) continue;
    matches.push({ id: r.id, name: String(name) });
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches.slice(0, 10);
}

/**
 * Submit feedback - main submission function
 */
function submitFeedback(feedbackData) {
  // Validate required fields
  if (!feedbackData.staffName || !feedbackData.staffName.trim()) {
    throw new Error('Please enter your name');
  }
  if (!feedbackData.feedbackType) {
    throw new Error('Please select a feedback type');
  }
  if (!feedbackData.description || !feedbackData.description.trim()) {
    throw new Error('Please enter a description');
  }

  // Run AI triage
  const triageResult = triageFeedback_(feedbackData);

  // Create Airtable record
  const record = createFeedbackRecord_(feedbackData, triageResult);

  // Send Slack notification
  const slackSent = sendFeedbackSlack_(feedbackData, triageResult);

  // Update record with slack notification status
  if (slackSent) {
    updateFeedbackSlackStatus_(record.id, true);
  }

  return {
    success: true,
    recordId: record.id,
    aiCategory: triageResult.category,
    aiSuggestion: triageResult.suggestion,
    slackNotified: slackSent
  };
}

// =============================================================================
// AI TRIAGE FUNCTIONS
// =============================================================================

/**
 * Main triage function - analyzes feedback and suggests category/action
 *
 * @param {Object} feedback - The feedback data
 * @returns {Object} {category, suggestion, confidence, itemExists, foundRecipeLineId}
 */
function triageFeedback_(feedback) {
  const result = {
    category: 'General',
    suggestion: '',
    confidence: 50,
    itemExists: null,
    foundRecipeLineId: null
  };

  const description = (feedback.description || '').toLowerCase();
  const feedbackType = feedback.feedbackType || '';

  // Pattern matching for common issues
  if (feedbackType === 'Missing Data') {
    result.category = 'Data Fix';
    result.confidence = 75;

    // Check for "missing ingredient" pattern
    if (description.includes('ingredient') || description.includes('missing') || description.includes('not found')) {
      const itemCheck = checkItemExists_(description, feedback.itemReferenceId);
      result.itemExists = itemCheck.exists;

      if (itemCheck.exists) {
        result.suggestion = `Item "${itemCheck.itemName}" exists in Items table (ID: ${itemCheck.itemId}). Check if it's linked to the correct recipe or supplier.`;
        result.confidence = 85;
      } else if (itemCheck.searchedName) {
        result.suggestion = `Could not find "${itemCheck.searchedName}" in Items table. Consider adding it as a new item.`;
        result.confidence = 80;
      } else {
        result.suggestion = 'Check Items table for the missing ingredient. May need to add a new item or update recipe linkages.';
      }
    } else {
      result.suggestion = 'Review the data in Airtable. Check Items, Recipes, or Par Levels tables for missing information.';
    }
  }

  if (feedbackType === 'Recipe Issue') {
    result.category = 'Recipe Update';
    result.confidence = 80;

    // Check for "wrong quantity" pattern
    if (description.includes('quantity') || description.includes('amount') || description.includes('wrong') || description.includes('incorrect')) {
      const recipeLineCheck = findRecipeLine_(feedback.recipeReferenceId, description);

      if (recipeLineCheck.found) {
        result.foundRecipeLineId = recipeLineCheck.recipeLineId;
        result.suggestion = `Identified Recipe Line: "${recipeLineCheck.ingredientName}" (current qty: ${recipeLineCheck.currentQty}). Update in Recipe Lines table.`;
        result.confidence = 90;
      } else {
        result.suggestion = 'Review the Recipe Lines table for this recipe. Check quantities and ingredient linkages.';
      }
    } else if (description.includes('method') || description.includes('step') || description.includes('instruction')) {
      result.suggestion = 'Review the recipe Method field in Recipes table. May need to update instructions.';
    } else {
      result.suggestion = 'Review the recipe configuration in Recipes and Recipe Lines tables.';
    }
  }

  if (feedbackType === 'Suggestion') {
    result.category = 'General';
    result.confidence = 60;
    result.suggestion = 'Review suggestion for potential system improvement. Consider discussing in next prep planning meeting.';
  }

  if (feedbackType === 'Other') {
    result.category = 'General';
    result.confidence = 40;
    result.suggestion = 'Review feedback and determine appropriate action.';
  }

  return result;
}

/**
 * Check if an item exists in the Items table
 */
function checkItemExists_(description, itemReferenceId) {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  // If explicit item reference provided, verify it exists
  if (itemReferenceId && itemReferenceId.startsWith('rec')) {
    try {
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.items)}/${itemReferenceId}`;
      const response = UrlFetchApp.fetch(url, {
        headers: { 'Authorization': `Bearer ${pat}` },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        const record = JSON.parse(response.getContentText());
        return {
          exists: true,
          itemId: record.id,
          itemName: record.fields['Item Name']
        };
      }
    } catch (e) {
      Logger.log('Error checking item: ' + e.message);
    }
    return { exists: false };
  }

  // Try to extract item name from description
  const patterns = [
    /missing\s+["']?(\w+(?:\s+\w+)*)["']?/i,
    /["']?(\w+(?:\s+\w+)*)["']?\s+(?:not found|is missing|doesn't exist)/i,
    /can'?t find\s+["']?(\w+(?:\s+\w+)*)["']?/i,
    /no\s+["']?(\w+(?:\s+\w+)*)["']?/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const searchTerm = match[1].trim();
      if (searchTerm.length < 2) continue;

      // Search for this item
      const items = searchItems(searchTerm);
      if (items.length > 0) {
        // Check for exact or close match
        const exactMatch = items.find(i => i.name.toLowerCase() === searchTerm.toLowerCase());
        if (exactMatch) {
          return { exists: true, itemId: exactMatch.id, itemName: exactMatch.name, searchedName: searchTerm };
        }
        // Return first partial match
        return { exists: true, itemId: items[0].id, itemName: items[0].name, searchedName: searchTerm };
      }
      return { exists: false, searchedName: searchTerm };
    }
  }

  return { exists: null };
}

/**
 * Find the recipe line that may need updating
 */
function findRecipeLine_(recipeReferenceId, description) {
  if (!recipeReferenceId || !recipeReferenceId.startsWith('rec')) {
    return { found: false };
  }

  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  try {
    const allLines = airtableListAll_(FEEDBACK_CONFIG.airtable.tables.recipeLines, {
      fields: ['Recipe', 'Item', 'Qty'],
      pageSize: 100
    });

    // Filter to lines for this recipe
    const recipeLines = allLines.filter(line => {
      const linkedRecipeIds = line.fields['Recipe'];
      if (!Array.isArray(linkedRecipeIds)) return false;
      return linkedRecipeIds.includes(recipeReferenceId);
    });

    if (recipeLines.length === 0) {
      return { found: false };
    }

    // Get item names for matching
    const itemIds = recipeLines
      .map(l => l.fields['Item'])
      .filter(Boolean)
      .flat();

    // Fetch item names
    const itemsById = {};
    for (const itemId of [...new Set(itemIds)]) {
      try {
        const itemUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.items)}/${itemId}`;
        const itemResponse = UrlFetchApp.fetch(itemUrl, {
          headers: { 'Authorization': `Bearer ${pat}` },
          muteHttpExceptions: true
        });
        if (itemResponse.getResponseCode() === 200) {
          const itemRecord = JSON.parse(itemResponse.getContentText());
          itemsById[itemId] = itemRecord.fields['Item Name'];
        }
      } catch (e) {
        // Skip failed fetches
      }
    }

    // Try to match ingredient name from description
    const descLower = description.toLowerCase();

    for (const line of recipeLines) {
      const itemId = Array.isArray(line.fields['Item']) ? line.fields['Item'][0] : line.fields['Item'];
      const ingredientName = itemsById[itemId];

      if (ingredientName && descLower.includes(ingredientName.toLowerCase())) {
        return {
          found: true,
          recipeLineId: line.id,
          ingredientName: ingredientName,
          currentQty: line.fields['Qty']
        };
      }
    }

    return { found: false };
  } catch (e) {
    Logger.log('Error finding recipe line: ' + e.message);
    return { found: false };
  }
}

// =============================================================================
// SLACK NOTIFICATION
// =============================================================================

/**
 * Send feedback notification to admin Slack channel
 */
function sendFeedbackSlack_(feedback, triageResult) {
  const props = PropertiesService.getScriptProperties();
  // Use the Waratah prep channel for feedback notifications; fall back to EV_TEST if not configured.
  const webhookUrl = props.getProperty('SLACK_WEBHOOK_WARATAH_PREP') ||
                     props.getProperty('SLACK_WEBHOOK_EV_TEST');

  if (!webhookUrl) {
    Logger.log('No feedback Slack webhook configured (SLACK_WEBHOOK_WARATAH_PREP or SLACK_WEBHOOK_EV_TEST), skipping notification');
    return false;
  }

  const emoji = {
    'Missing Data': ':warning:',
    'Recipe Issue': ':clipboard:',
    'Suggestion': ':bulb:',
    'Other': ':speech_balloon:'
  };

  const categoryEmoji = {
    'Data Fix': ':wrench:',
    'Recipe Update': ':cooking:',
    'General': ':memo:'
  };

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji[feedback.feedbackType] || ':speech_balloon:'} New Prep Feedback`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*From:*\n${feedback.staffName}`
        },
        {
          type: "mrkdwn",
          text: `*Role:*\n${feedback.staffRole || 'Not specified'}`
        },
        {
          type: "mrkdwn",
          text: `*Document:*\n${feedback.docType || 'Not specified'}`
        },
        {
          type: "mrkdwn",
          text: `*Type:*\n${feedback.feedbackType}`
        }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Description:*\n>${feedback.description.split('\n').join('\n>')}`
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*AI Triage:* ${categoryEmoji[triageResult.category] || ''} ${triageResult.category} (${triageResult.confidence}% confidence)\n${triageResult.suggestion ? `*Suggestion:* ${triageResult.suggestion}` : ''}`
      }
    }
  ];

  // Add item/recipe references if present
  if (feedback.itemReferenceName || feedback.recipeReferenceName) {
    const refFields = [];
    if (feedback.itemReferenceName) {
      refFields.push({
        type: "mrkdwn",
        text: `*Item Reference:*\n${feedback.itemReferenceName}`
      });
    }
    if (feedback.recipeReferenceName) {
      refFields.push({
        type: "mrkdwn",
        text: `*Recipe Reference:*\n${feedback.recipeReferenceName}`
      });
    }
    blocks.splice(3, 0, {
      type: "section",
      fields: refFields
    });
  }

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ blocks }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return true;
    } else {
      Logger.log('Slack notification failed: ' + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log('Slack notification error: ' + e.message);
    return false;
  }
}

// =============================================================================
// AIRTABLE WRITE FUNCTIONS
// =============================================================================

/**
 * Create feedback record in Airtable
 */
function createFeedbackRecord_(feedback, triageResult) {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  if (!baseId || !pat) {
    throw new Error('Airtable credentials not configured');
  }

  const fields = {
    'Staff Name': feedback.staffName.trim(),
    'Feedback Type': feedback.feedbackType,
    'Description': feedback.description.trim(),
    'AI Category': triageResult.category,
    'AI Suggestion': triageResult.suggestion || '',
    'AI Confidence': triageResult.confidence,
    'Status': 'New'
  };

  // Add optional fields
  if (feedback.staffRole) {
    fields['Staff Role'] = feedback.staffRole;
  }
  if (feedback.docType) {
    fields['Doc Type'] = feedback.docType;
  }
  if (feedback.prepRunId && feedback.prepRunId.startsWith('rec')) {
    fields['Prep Run'] = [feedback.prepRunId];
  }
  if (feedback.itemReferenceId && feedback.itemReferenceId.startsWith('rec')) {
    fields['Item Reference'] = [feedback.itemReferenceId];
  }
  if (feedback.recipeReferenceId && feedback.recipeReferenceId.startsWith('rec')) {
    fields['Recipe Reference'] = [feedback.recipeReferenceId];
  }
  if (triageResult.itemExists !== null) {
    fields['Item Exists Check'] = triageResult.itemExists;
  }
  if (triageResult.foundRecipeLineId) {
    fields['Found Recipe Line'] = [triageResult.foundRecipeLineId];
  }

  // POST to Airtable
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.feedback)}`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${pat}` },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    const errorText = response.getContentText();
    Logger.log('Airtable create failed: ' + errorText);
    throw new Error('Failed to save feedback. Please try again.');
  }

  return JSON.parse(response.getContentText());
}

/**
 * Update feedback record with Slack notification status
 */
function updateFeedbackSlackStatus_(recordId, slackSent) {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  if (!baseId || !pat || !recordId) return;

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.feedback)}/${recordId}`;
    UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${pat}` },
      payload: JSON.stringify({ fields: { 'Slack Notified': slackSent } }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('Failed to update Slack status: ' + e.message);
  }
}

