/**
 * Debug utilities for the Waratah PREP GAS project.
 * Run these from the Apps Script editor to diagnose configuration issues.
 * NOT deployed to production — excluded via .claspignore.
 */

// =============================================================================
// AIRTABLE CONNECTION DEBUG
// =============================================================================

function debugAirtableConnection() {
  const baseId = getAirtableBaseId_();
  const pat = getAirtablePat_();

  Logger.log("==== PROPS CHECK ====");
  Logger.log({
    AIRTABLE_BASE_ID: baseId,
    baseIdLooksCorrect: baseId.startsWith("app") && baseId.length > 10,
    AIRTABLE_PAT_prefix: pat.slice(0, 6),
    patLooksCorrect: pat.startsWith("pat"),
    DOCS_FOLDER_ID: getDocsFolderId_(),
    MANUAL_TRIGGER_SECRET_set: !!PropertiesService.getScriptProperties().getProperty(CFG.props.manualTriggerSecret),
    WARATAH_TEMPLATE_ANDIE_ORDERING_ID: getOptionalProp_(CFG.props.templateOrderingAndie) || "(not set)",
    WARATAH_TEMPLATE_BLADE_ORDERING_ID: getOptionalProp_(CFG.props.templateOrderingBlade) || "(not set)",
    WARATAH_TEMPLATE_BATCHING_ID: getOptionalProp_(CFG.props.templateBatching) || "(not set)",
    WARATAH_TEMPLATE_INGREDIENT_PREP_ID: getOptionalProp_(CFG.props.templateIngredientPrep) || "(not set)",
  });

  Logger.log("==== SIMPLE TABLE GETS ====");
  const tests = [
    CFG.airtable.tables.items,
    CFG.airtable.tables.runs,
    CFG.airtable.tables.tasks,
    CFG.airtable.tables.reqs,
    CFG.airtable.tables.recipeLines,
    CFG.airtable.tables.supplier,
  ];

  tests.forEach((t) => {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(t)}?maxRecords=1`;
    const resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: `Bearer ${pat}` },
      muteHttpExceptions: true,
    });
    Logger.log(`${t}: HTTP ${resp.getResponseCode()} → ${resp.getContentText()}`);
  });
}

// =============================================================================
// FEEDBACK FORM DEBUG
// =============================================================================

function debugFeedbackForm() {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');
  const slackWebhook = props.getProperty('SLACK_WEBHOOK_EV_TEST');

  Logger.log('=== Feedback Form Debug ===');
  Logger.log('AIRTABLE_BASE_ID: ' + (baseId ? 'SET (' + baseId + ')' : 'NOT SET'));
  Logger.log('AIRTABLE_PAT: ' + (pat ? 'SET (' + pat.substring(0, 10) + '...)' : 'NOT SET'));
  Logger.log('SLACK_WEBHOOK_EV_TEST: ' + (slackWebhook ? 'SET' : 'NOT SET'));

  // Test Airtable connection
  if (baseId && pat) {
    try {
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(FEEDBACK_CONFIG.airtable.tables.items)}?maxRecords=1`;
      const response = UrlFetchApp.fetch(url, {
        headers: { 'Authorization': `Bearer ${pat}` },
        muteHttpExceptions: true
      });
      Logger.log('Airtable connection: ' + (response.getResponseCode() === 200 ? 'OK' : 'FAILED - ' + response.getResponseCode()));
    } catch (e) {
      Logger.log('Airtable connection: FAILED - ' + e.message);
    }
  }

  // Test form config
  Logger.log('Form config: ' + JSON.stringify(getFormConfig()));

  // Test item search
  const testSearch = searchItems('test');
  Logger.log('Item search "test": ' + testSearch.length + ' results');

  Logger.log('=== Debug Complete ===');
}

// =============================================================================
// RECIPE SCALER DEBUG
// =============================================================================

function debugRecipeScaler() {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  Logger.log('=== RECIPE SCALER DEBUG ===');
  Logger.log('Base ID: ' + baseId);
  Logger.log('PAT prefix: ' + (pat ? pat.substring(0, 10) + '...' : 'NOT SET'));

  // Test 1: Fetch one recipe to see all available fields
  Logger.log('\n=== TEST 1: Fetch first recipe (all fields) ===');
  try {
    const recipesUrl = `https://api.airtable.com/v0/${baseId}/Recipes?maxRecords=1`;
    const resp = UrlFetchApp.fetch(recipesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First recipe fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  // Test 2: Fetch one recipe line to see all available fields
  Logger.log('\n=== TEST 2: Fetch first recipe line (all fields) ===');
  try {
    const linesUrl = `https://api.airtable.com/v0/${baseId}/Recipe%20Lines?maxRecords=1`;
    const resp = UrlFetchApp.fetch(linesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First recipe line fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  // Test 3: Fetch one item to see all available fields
  Logger.log('\n=== TEST 3: Fetch first item (all fields) ===');
  try {
    const itemsUrl = `https://api.airtable.com/v0/${baseId}/Items?maxRecords=1`;
    const resp = UrlFetchApp.fetch(itemsUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First item fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  Logger.log('\n=== DEBUG COMPLETE ===');
}
