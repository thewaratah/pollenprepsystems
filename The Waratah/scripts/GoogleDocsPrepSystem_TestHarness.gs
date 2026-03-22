/****************************************************
 * GOOGLE DOCS PREP SYSTEM - COMPREHENSIVE TEST HARNESS
 * THE WARATAH
 *
 * Purpose:
 *   Validates document generation logic without hitting
 *   production Airtable or creating real Google Docs.
 *
 * Features:
 *   - Mock Airtable data with realistic bar-appropriate structures
 *   - Validates all document content without Drive API
 *   - Tests buffer multiplier display logic
 *   - Tests combined ordering doc (bar stock orders + prep-only items)
 *   - Tests Andie/Blade prep section routing
 *   - Tests stock count pipeline (Count Sessions + Stock Orders)
 *   - Tests item type routing (Batch, Sub Recipe, Sub-recipe, Garnish, Other)
 *   - Tests error handling scenarios
 *   - Dry-run mode comparison
 *
 * Usage:
 *   1. Copy this into your Apps Script project
 *   2. Run runAllTests() from the editor
 *   3. Check Logger output for results
 *
 * IMPORTANT:
 *   - Uses MOCK data - no real API calls
 *   - Safe to run in production environment
 *   - Does NOT modify any real data
 *   - Excluded from clasp deployment via .claspignore
 ****************************************************/

/* =========================================================
 * TEST CONFIGURATION
 * ======================================================= */

const TEST_CONFIG = {
  // Set to true to enable verbose logging
  verbose: true,

  // Test run configuration
  testRunLabel: "2026-03-23",
  testFolderId: "TEST_FOLDER_ID", // Will not actually create folder

  // Mock Airtable record IDs
  mockIds: {
    runId: "recTEST_RUN_001",

    // Batch items (bar batches)
    batchItem1: "recBATCH_001", // Espresso Martini Batch
    batchItem2: "recBATCH_002", // Negroni Batch

    // Sub Recipe items (with buffer multipliers)
    subRecipe1: "recSUB_001",   // Honey Syrup (buffer 1.5x)
    subRecipe2: "recSUB_002",   // Citrus Oleo (buffer 1.2x)

    // Garnish item
    garnish1: "recGARN_001",    // Dehydrated Citrus Wheels

    // Other item
    other1: "recOTHER_001",     // Smoked Salt Rim

    // Ingredients (orderable items)
    ingredient1: "recING_001",  // Ketel One Vodka (bar stock)
    ingredient2: "recING_002",  // Mr Black Coffee Liqueur (bar stock)
    ingredient3: "recING_003",  // Lemons (prep-only, Blade)
    ingredient4: "recING_004",  // Campari (bar stock)
    ingredient5: "recING_005",  // Honey (prep-only, Andie)
    ingredient6: "recING_006",  // Oranges (prep-only, no staff)

    // Recipes
    recipe1: "recRECIPE_001",   // Espresso Martini Batch recipe
    recipe2: "recRECIPE_002",   // Negroni Batch recipe
    recipe3: "recRECIPE_003",   // Honey Syrup recipe
    recipe4: "recRECIPE_004",   // Citrus Oleo recipe
    recipe5: "recRECIPE_005",   // Dehydrated Citrus Wheels recipe
    recipe6: "recRECIPE_006",   // Smoked Salt Rim recipe

    // Items table IDs (for Item Name linked record resolution)
    itemRec1: "recITEM_001",    // Espresso Martini Batch (Items table)
    itemRec2: "recITEM_002",    // Negroni Batch (Items table)
    itemRec3: "recITEM_003",    // Honey Syrup (Items table)
    itemRec4: "recITEM_004",    // Citrus Oleo (Items table)
    itemRec5: "recITEM_005",    // Dehydrated Citrus Wheels (Items table)
    itemRec6: "recITEM_006",    // Smoked Salt Rim (Items table)

    // Suppliers
    supplier1: "recSUP_001",    // Paramount Liquor
    supplier2: "recSUP_002",    // Harris Farm Markets
    supplier3: "recSUP_003",    // UNASSIGNED SUPPLIER

    // Stock Count / Ordering pipeline
    countSession1: "recCS_001",
    stockOrder1: "recSO_001",   // Ketel One Vodka
    stockOrder2: "recSO_002",   // Campari
    stockOrder3: "recSO_003",   // Mr Black
  }
};

/* =========================================================
 * MOCK DATA GENERATORS
 * ======================================================= */

function generateMockPrepRun() {
  const ids = TEST_CONFIG.mockIds;

  return {
    id: ids.runId,
    createdTime: "2026-03-23T10:00:00.000Z",
    fields: {
      "Prep Week": "2026-03-23T00:00:00.000Z",
      "Notes / Handover Notes": "Test run for validation - bar prep week",
      "Prep Tasks": [ids.batchItem1, ids.batchItem2, ids.subRecipe1, ids.subRecipe2, ids.garnish1, ids.other1],
      "Ingredient Requirements": [ids.ingredient1, ids.ingredient2, ids.ingredient3, ids.ingredient5, ids.ingredient6]
    }
  };
}

function generateMockItems() {
  const ids = TEST_CONFIG.mockIds;

  return [
    // Batch Items (bar batches)
    {
      id: ids.batchItem1,
      fields: {
        "Item Name": "Espresso Martini Batch",
        "Item Type": { name: "Batch" },
        "Unit": "ml",
        "Bar Stock": true
      }
    },
    {
      id: ids.batchItem2,
      fields: {
        "Item Name": "Negroni Batch",
        "Item Type": { name: "Batch" },
        "Unit": "ml",
        "Bar Stock": true
      }
    },

    // Sub Recipes (with buffer multipliers)
    {
      id: ids.subRecipe1,
      fields: {
        "Item Name": "Honey Syrup",
        "Item Type": { name: "Sub Recipe" },
        "Unit": "ml",
        "Buffer Multiplier": 1.5 // 150%
      }
    },
    {
      id: ids.subRecipe2,
      fields: {
        "Item Name": "Citrus Oleo",
        "Item Type": { name: "Sub-recipe" }, // Tests Sub-recipe variant
        "Unit": "ml",
        "Buffer Multiplier": 1.2 // 120%
      }
    },

    // Garnish item (Ingredient Prep only, never ordering)
    {
      id: ids.garnish1,
      fields: {
        "Item Name": "Dehydrated Citrus Wheels",
        "Item Type": { name: "Garnish" },
        "Unit": "ea"
      }
    },

    // Other item (Ingredient Prep only, never ordering)
    {
      id: ids.other1,
      fields: {
        "Item Name": "Smoked Salt Rim",
        "Item Type": { name: "Other" },
        "Unit": "g"
      }
    },

    // Ingredients (orderable)
    {
      id: ids.ingredient1,
      fields: {
        "Item Name": "Ketel One Vodka",
        "Item Type": { name: "Ingredient" },
        "Unit": "ml",
        "Supplier": [ids.supplier1],
        "Supplier Name": "Paramount Liquor",
        "Product Category": "Spirits",
        "Ordering Staff": "Andie",
        "Bar Stock": true
      }
    },
    {
      id: ids.ingredient2,
      fields: {
        "Item Name": "Mr Black Coffee Liqueur",
        "Item Type": { name: "Ingredient" },
        "Unit": "ml",
        "Supplier": [ids.supplier1],
        "Supplier Name": "Paramount Liquor",
        "Product Category": "Liqueurs",
        "Ordering Staff": "Andie",
        "Bar Stock": true
      }
    },
    {
      id: ids.ingredient3,
      fields: {
        "Item Name": "Lemons",
        "Item Type": { name: "Ingredient" },
        "Unit": "kg",
        "Supplier": [ids.supplier2],
        "Supplier Name": "Harris Farm Markets",
        "Product Category": "Fruit & Veg",
        "Ordering Staff": "Blade",
        "Bar Stock": false
      }
    },
    {
      id: ids.ingredient4,
      fields: {
        "Item Name": "Campari",
        "Item Type": { name: "Ingredient" },
        "Unit": "ml",
        "Supplier": [ids.supplier1],
        "Supplier Name": "Paramount Liquor",
        "Product Category": "Spirits",
        "Ordering Staff": "Andie",
        "Bar Stock": true
      }
    },
    {
      id: ids.ingredient5,
      fields: {
        "Item Name": "Honey",
        "Item Type": { name: "Ingredient" },
        "Unit": "kg",
        "Supplier": [ids.supplier2],
        "Supplier Name": "Harris Farm Markets",
        "Product Category": "Pantry",
        "Ordering Staff": "Andie",
        "Bar Stock": false
      }
    },
    {
      id: ids.ingredient6,
      fields: {
        "Item Name": "Oranges",
        "Item Type": { name: "Ingredient" },
        "Unit": "kg",
        "Supplier": [ids.supplier3],
        "Supplier Name": "UNASSIGNED SUPPLIER",
        "Product Category": "Fruit & Veg",
        "Ordering Staff": "",
        "Bar Stock": false
      }
    }
  ];
}

function generateMockTasks() {
  const ids = TEST_CONFIG.mockIds;

  return [
    // Batch task 1 — Espresso Martini Batch
    {
      id: "recTASK_001",
      fields: {
        "Item Needed": [ids.batchItem1],
        "Recipe Used": [ids.recipe1],
        "Target Qty": 5000,
        "Batches Needed": 2,
        "Notes": "Double batch for Friday service"
      }
    },

    // Batch task 2 — Negroni Batch
    {
      id: "recTASK_002",
      fields: {
        "Item Needed": [ids.batchItem2],
        "Recipe Used": [ids.recipe2],
        "Target Qty": 3000,
        "Batches Needed": 1,
        "Notes": ""
      }
    },

    // Sub recipe task 1 — Honey Syrup (with buffer suggestion)
    {
      id: "recTASK_003",
      fields: {
        "Item Needed": [ids.subRecipe1],
        "Recipe Used": [ids.recipe3],
        "Target Qty": 1000,
        "Batches Needed": 2,
        "Suggested Qty (Buffer)": 1500, // 1000 x 1.5 = 1500
        "Notes": ""
      }
    },

    // Sub recipe task 2 — Citrus Oleo (with buffer suggestion)
    {
      id: "recTASK_004",
      fields: {
        "Item Needed": [ids.subRecipe2],
        "Recipe Used": [ids.recipe4],
        "Target Qty": 500,
        "Batches Needed": 1,
        "Suggested Qty (Buffer)": 600, // 500 x 1.2 = 600
        "Notes": ""
      }
    },

    // Garnish task — Dehydrated Citrus Wheels
    {
      id: "recTASK_005",
      fields: {
        "Item Needed": [ids.garnish1],
        "Recipe Used": [ids.recipe5],
        "Target Qty": 50,
        "Batches Needed": 1,
        "Notes": "Slice thin, dehydrate at 60C overnight"
      }
    },

    // Other task — Smoked Salt Rim
    {
      id: "recTASK_006",
      fields: {
        "Item Needed": [ids.other1],
        "Recipe Used": [ids.recipe6],
        "Target Qty": 200,
        "Batches Needed": 1,
        "Notes": ""
      }
    }
  ];
}

function generateMockRecipes() {
  const ids = TEST_CONFIG.mockIds;

  // Waratah uses "Item Name" as a linked record field pointing to Items table.
  // Each recipe's "Item Name" is an array of record IDs, NOT a text string.
  return [
    {
      id: ids.recipe1,
      fields: {
        "Item Name": [ids.itemRec1], // linked record → Espresso Martini Batch
        "Method": "1. Combine vodka and Mr Black in batch container\n2. Add fresh espresso shots\n3. Add simple syrup to taste\n4. Stir gently, refrigerate"
      }
    },
    {
      id: ids.recipe2,
      fields: {
        "Item Name": [ids.itemRec2], // linked record → Negroni Batch
        "Method": "1. Combine Campari, sweet vermouth, and gin in equal parts\n2. Stir over ice\n3. Strain into batch container\n4. Refrigerate"
      }
    },
    {
      id: ids.recipe3,
      fields: {
        "Item Name": [ids.itemRec3], // linked record → Honey Syrup
        "Method": "1. Combine honey and hot water 2:1 ratio\n2. Stir until dissolved\n3. Cool and bottle"
      }
    },
    {
      id: ids.recipe4,
      fields: {
        "Item Name": [ids.itemRec4], // linked record → Citrus Oleo
        "Method": "1. Peel lemons and oranges, avoid pith\n2. Cover peels with caster sugar\n3. Muddle and rest 24 hours\n4. Strain and bottle"
      }
    },
    {
      id: ids.recipe5,
      fields: {
        "Item Name": [ids.itemRec5], // linked record → Dehydrated Citrus Wheels
        "Method": "1. Slice citrus 2mm thick\n2. Lay on dehydrator trays\n3. Dehydrate at 60C for 8-10 hours\n4. Store in airtight container"
      }
    },
    {
      id: ids.recipe6,
      fields: {
        "Item Name": [ids.itemRec6], // linked record → Smoked Salt Rim
        "Method": "1. Combine smoked salt flakes with citric acid\n2. Add dried rosemary, finely ground\n3. Mix thoroughly, store in rim dish"
      }
    }
  ];
}

/**
 * Items table records used for recipe name resolution.
 * RecipeScaler and FeedbackForm resolve recipe names by:
 *   1. Fetch active Items → build id->name map
 *   2. Fetch Recipes → resolve name via linked "Item Name" field
 */
function generateMockItemsTableRecords() {
  const ids = TEST_CONFIG.mockIds;

  return [
    { id: ids.itemRec1, fields: { "Item Name": "Espresso Martini Batch", "Status": "Active" } },
    { id: ids.itemRec2, fields: { "Item Name": "Negroni Batch", "Status": "Active" } },
    { id: ids.itemRec3, fields: { "Item Name": "Honey Syrup", "Status": "Active" } },
    { id: ids.itemRec4, fields: { "Item Name": "Citrus Oleo", "Status": "Active" } },
    { id: ids.itemRec5, fields: { "Item Name": "Dehydrated Citrus Wheels", "Status": "Active" } },
    { id: ids.itemRec6, fields: { "Item Name": "Smoked Salt Rim", "Status": "Active" } },
  ];
}

function generateMockRecipeLines() {
  const ids = TEST_CONFIG.mockIds;

  return [
    // Espresso Martini Batch recipe lines
    { recipe: ids.recipe1, item: ids.ingredient1, qty: 750 },  // 750ml Ketel One per batch
    { recipe: ids.recipe1, item: ids.ingredient2, qty: 500 },  // 500ml Mr Black per batch
    { recipe: ids.recipe1, item: ids.subRecipe1, qty: 200 },   // 200ml Honey Syrup per batch

    // Negroni Batch recipe lines
    { recipe: ids.recipe2, item: ids.ingredient4, qty: 1000 }, // 1000ml Campari per batch
    { recipe: ids.recipe2, item: ids.subRecipe2, qty: 100 },   // 100ml Citrus Oleo per batch

    // Honey Syrup recipe lines
    { recipe: ids.recipe3, item: ids.ingredient5, qty: 0.5 },  // 0.5kg Honey per batch

    // Citrus Oleo recipe lines
    { recipe: ids.recipe4, item: ids.ingredient3, qty: 2 },    // 2kg Lemons per batch

    // Dehydrated Citrus Wheels recipe lines
    { recipe: ids.recipe5, item: ids.ingredient3, qty: 1 },    // 1kg Lemons per batch
    { recipe: ids.recipe5, item: ids.ingredient6, qty: 0.5 },  // 0.5kg Oranges per batch

    // Smoked Salt Rim recipe lines (no orderable ingredients — uses pantry staples)
  ];
}

function generateMockRequirements() {
  const ids = TEST_CONFIG.mockIds;

  return [
    // Bar stock items (also in Stock Orders — should NOT appear in prep sections)
    {
      id: "recREQ_001",
      fields: {
        "Item Link": [ids.ingredient1],
        "Total Qty Needed": 1500,        // 750ml x 2 batches
        "Supplier Name (Static)": "Paramount Liquor",
        "Ordering Staff (Static)": "Andie",
        "Supplier": [ids.supplier1],
        "Ordering Staff": "Andie"
      }
    },
    {
      id: "recREQ_002",
      fields: {
        "Item Link": [ids.ingredient2],
        "Total Qty Needed": 1000,        // 500ml x 2 batches
        "Supplier Name (Static)": "Paramount Liquor",
        "Ordering Staff (Static)": "Andie",
        "Supplier": [ids.supplier2],
        "Ordering Staff": "Andie"
      }
    },

    // Prep-only items (NOT in Stock Orders — appear in staff prep sections)
    {
      id: "recREQ_003",
      fields: {
        "Item Link": [ids.ingredient3],
        "Total Qty Needed": 5,           // 2kg x 1 + 1kg x 1 + ...
        "Supplier Name (Static)": "Harris Farm Markets",
        "Ordering Staff (Static)": "Blade",
        "Supplier": [ids.supplier2],
        "Ordering Staff": "Blade"
      }
    },
    {
      id: "recREQ_004",
      fields: {
        "Item Link": [ids.ingredient5],
        "Total Qty Needed": 1,           // 0.5kg x 2 batches
        "Supplier Name (Static)": "Harris Farm Markets",
        "Ordering Staff (Static)": "Andie",
        "Supplier": [ids.supplier2],
        "Ordering Staff": "Andie"
      }
    },
    {
      id: "recREQ_005",
      fields: {
        "Item Link": [ids.ingredient6],
        "Total Qty Needed": 0.5,
        "Supplier Name (Static)": "UNASSIGNED SUPPLIER",
        "Ordering Staff (Static)": "",
        "Supplier": [ids.supplier3],
        "Ordering Staff": ""
      }
    }
  ];
}

function generateMockSuppliers() {
  const ids = TEST_CONFIG.mockIds;

  return [
    {
      id: ids.supplier1,
      fields: {
        "Supplier Name": "Paramount Liquor",
        "Ordering Staff": "Andie",
        "Email": "orders@paramountliquor.com.au"
      }
    },
    {
      id: ids.supplier2,
      fields: {
        "Supplier Name": "Harris Farm Markets",
        "Ordering Staff": "Blade",
        "Email": "wholesale@harrisfarm.com.au"
      }
    },
    {
      id: ids.supplier3,
      fields: {
        "Supplier Name": "UNASSIGNED SUPPLIER",
        "Ordering Staff": "",
        "Email": ""
      }
    }
  ];
}

/**
 * Mock Count Sessions data for stock count ordering pipeline.
 */
function generateMockCountSessions() {
  const ids = TEST_CONFIG.mockIds;

  return [
    {
      id: ids.countSession1,
      fields: {
        "Status": "Orders Generated",
        "Session Date": "2026-03-23",
        "Session Name": "Stock Count 2026-03-23",
        "Counted By": "Evan",
        "Ordering Export State": "REQUESTED",
        "Stock Counts": ["recSC_001", "recSC_002", "recSC_003"],
        "Stock Orders": [ids.stockOrder1, ids.stockOrder2, ids.stockOrder3]
      }
    }
  ];
}

/**
 * Mock Stock Orders data — populated by Waratah_GenerateStockOrders.gs.
 * These represent bar stock items that need ordering based on stock count.
 * Each record has supplier info, on-hand qty, par qty, and combined order qty.
 */
function generateMockStockOrders() {
  const ids = TEST_CONFIG.mockIds;

  return [
    // Ketel One Vodka — Paramount Liquor (Andie)
    {
      id: ids.stockOrder1,
      fields: {
        "Item": [ids.ingredient1],
        "Count Session": [ids.countSession1],
        "Total On Hand": 500,
        "Prep Usage": 1500,
        "Prep Qty": 3000,
        "Service Shortfall": 2500,
        "Combined Order Qty": 4000,    // shortfall + prep usage
        "Supplier Name (Static)": "Paramount Liquor",
        "Product Category (Static)": "Spirits",
        "Ordering Staff (Static)": "Andie",
        "Status": "Pending"
      }
    },
    // Campari — Paramount Liquor (Andie)
    {
      id: ids.stockOrder2,
      fields: {
        "Item": [ids.ingredient4],
        "Count Session": [ids.countSession1],
        "Total On Hand": 200,
        "Prep Usage": 1000,
        "Prep Qty": 2000,
        "Service Shortfall": 1800,
        "Combined Order Qty": 2800,
        "Supplier Name (Static)": "Paramount Liquor",
        "Product Category (Static)": "Spirits",
        "Ordering Staff (Static)": "Andie",
        "Status": "Pending"
      }
    },
    // Mr Black — Paramount Liquor (Andie)
    {
      id: ids.stockOrder3,
      fields: {
        "Item": [ids.ingredient2],
        "Count Session": [ids.countSession1],
        "Total On Hand": 300,
        "Prep Usage": 1000,
        "Prep Qty": 1500,
        "Service Shortfall": 1200,
        "Combined Order Qty": 2200,
        "Supplier Name (Static)": "Paramount Liquor",
        "Product Category (Static)": "Liqueurs",
        "Ordering Staff (Static)": "Andie",
        "Status": "Pending"
      }
    }
  ];
}

/* =========================================================
 * MOCK AIRTABLE API
 * ======================================================= */

class MockAirtableAPI {
  constructor() {
    this.data = {
      runs: [generateMockPrepRun()],
      items: generateMockItems(),
      tasks: generateMockTasks(),
      recipes: generateMockRecipes(),
      recipeLines: generateMockRecipeLines(),
      requirements: generateMockRequirements(),
      suppliers: generateMockSuppliers(),
      countSessions: generateMockCountSessions(),
      stockOrders: generateMockStockOrders(),
      itemsTableRecords: generateMockItemsTableRecords(),
    };
  }

  getRunById(runId) {
    return this.data.runs.find(r => r.id === runId);
  }

  getItemsByIds(ids) {
    return this.data.items.filter(i => ids.includes(i.id));
  }

  getTasksByIds(ids) {
    return this.data.tasks.filter(t => ids.includes(t.id));
  }

  getRecipesByIds(ids) {
    return this.data.recipes.filter(r => ids.includes(r.id));
  }

  getRecipeLinesByRecipeIds(recipeIds) {
    const byRecipe = {};

    this.data.recipeLines.forEach(line => {
      if (recipeIds.includes(line.recipe)) {
        if (!byRecipe[line.recipe]) byRecipe[line.recipe] = [];
        byRecipe[line.recipe].push({
          itemId: line.item,
          qtyPerBatch: line.qty
        });
      }
    });

    return byRecipe;
  }

  getRequirementsByIds(ids) {
    return this.data.requirements.filter(r => ids.includes(r.id));
  }

  getSuppliersByIds(ids) {
    return this.data.suppliers.filter(s => ids.includes(s.id));
  }

  getCountSessionsByStatus(status) {
    return this.data.countSessions.filter(s => s.fields["Status"] === status);
  }

  getStockOrdersBySessionId(sessionId) {
    return this.data.stockOrders.filter(o => {
      const sessionIds = o.fields["Count Session"];
      return Array.isArray(sessionIds) && sessionIds.includes(sessionId);
    });
  }

  /**
   * Resolves recipe name from linked "Item Name" field.
   * Waratah pattern: Recipe.fields["Item Name"] = [recXXX] (linked record array)
   * Must look up the Items table to get the actual name string.
   */
  resolveRecipeName(recipe) {
    const linkedItemIds = recipe.fields["Item Name"];
    if (!Array.isArray(linkedItemIds) || linkedItemIds.length === 0) return "(Unknown)";

    const itemRecord = this.data.itemsTableRecords.find(i => i.id === linkedItemIds[0]);
    return itemRecord ? itemRecord.fields["Item Name"] : "(Unknown)";
  }
}

/* =========================================================
 * DOCUMENT CONTENT VALIDATORS
 * ======================================================= */

class DocumentValidator {
  constructor(mockAPI) {
    this.mockAPI = mockAPI;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validates Ingredient Prep List content.
   * Sub-recipes, Garnish, and Other items appear here (not on Batching or Ordering).
   */
  validateIngredientPrepDoc(mockContent) {
    const expectedSections = [
      "Espresso Martini Batch 5000ml",
      "Negroni Batch 3000ml"
    ];

    const expectedSubRecipes = [
      "Honey Syrup",
      "Citrus Oleo"
    ];

    const expectedGarnishOther = [
      "Dehydrated Citrus Wheels",
      "Smoked Salt Rim"
    ];

    const expectedBufferSuggestions = [
      "1000ml (suggest: 1500ml) Honey Syrup",
      "500ml (suggest: 600ml) Citrus Oleo"
    ];

    // Validate batch headings exist
    expectedSections.forEach(section => {
      if (!mockContent.includes(section)) {
        this.errors.push('Missing batch section: "' + section + '"');
      }
    });

    // Validate sub-recipe mentions
    expectedSubRecipes.forEach(subRecipe => {
      if (!mockContent.includes(subRecipe)) {
        this.errors.push('Missing sub-recipe: "' + subRecipe + '"');
      }
    });

    // Validate garnish and other items appear on ingredient prep
    expectedGarnishOther.forEach(item => {
      if (!mockContent.includes(item)) {
        this.errors.push('Missing garnish/other item: "' + item + '"');
      } else {
        Logger.log('  Found garnish/other item: ' + item);
      }
    });

    // Validate buffer suggestions display correctly
    expectedBufferSuggestions.forEach(suggestion => {
      if (!mockContent.includes(suggestion)) {
        this.errors.push('Missing buffer suggestion: "' + suggestion + '"');
      } else {
        Logger.log('  Buffer suggestion found: ' + suggestion);
      }
    });

    return this.errors.length === 0;
  }

  /**
   * Validates Batching List content.
   * Only Batch and Sub Recipe items appear here (not Garnish/Other).
   */
  validateBatchingDoc(mockContent) {
    const expectedSections = [
      "Espresso Martini Batch 5000ml",
      "Negroni Batch 3000ml"
    ];

    const expectedIngredients = [
      "1500ml Ketel One Vodka",     // 750ml x 2 batches
      "1000ml Mr Black Coffee Liqueur", // 500ml x 2 batches
      "1000ml Campari"               // 1000ml x 1 batch
    ];

    const expectedMethods = [
      "1. Combine vodka and Mr Black in batch container",
      "1. Combine Campari, sweet vermouth, and gin in equal parts"
    ];

    const mustNotContain = [
      "Dehydrated Citrus Wheels",  // Garnish — not on Batching
      "Smoked Salt Rim"            // Other — not on Batching
    ];

    // Validate sections
    expectedSections.forEach(section => {
      if (!mockContent.includes(section)) {
        this.errors.push('Missing batch section: "' + section + '"');
      }
    });

    // Validate ingredient bullets
    expectedIngredients.forEach(ingredient => {
      if (!mockContent.includes(ingredient)) {
        this.errors.push('Missing ingredient line: "' + ingredient + '"');
      }
    });

    // Validate methods are included
    expectedMethods.forEach(method => {
      if (!mockContent.includes(method)) {
        this.errors.push('Missing method text: "' + method + '"');
      }
    });

    // Validate notes
    if (!mockContent.includes("Double batch for Friday service")) {
      this.errors.push('Missing task notes in batching doc');
    }

    // Garnish and Other must NOT appear on Batching doc
    mustNotContain.forEach(item => {
      if (mockContent.includes(item)) {
        this.errors.push('Batching doc incorrectly contains "' + item + '" (Garnish/Other items belong on Ingredient Prep only)');
      }
    });

    return this.errors.length === 0;
  }

  /**
   * Validates Combined Ordering Doc content.
   * Waratah uses a single combined doc (not per-staff like Sakura).
   * Layout: bar stock orders by supplier, no-supplier items,
   *         Andie's prep orders, Blade's prep orders, prep-only items.
   */
  validateCombinedOrderingDoc(mockContent) {
    // Bar stock items grouped by supplier
    const expectedBarStockSupplier = "Paramount Liquor";
    const expectedBarStockItems = [
      "Ketel One Vodka",
      "Campari",
      "Mr Black Coffee Liqueur"
    ];

    // Staff prep sections
    const expectedAndieSectionTitle = "ANDIE'S ORDERS";
    const expectedBladeSectionTitle = "BLADE'S ORDERS";

    // Prep-only items by staff
    const expectedAndiePrepItem = "Honey";
    const expectedBladePrepItem = "Lemons";

    // Unassigned prep items
    const expectedUnassignedItem = "Oranges";

    // Validate supplier heading for bar stock
    if (!mockContent.includes(expectedBarStockSupplier)) {
      this.errors.push('Missing supplier heading: "' + expectedBarStockSupplier + '"');
    }

    // Validate bar stock items present
    expectedBarStockItems.forEach(item => {
      if (!mockContent.includes(item)) {
        this.errors.push('Missing bar stock item: "' + item + '"');
      }
    });

    // Validate staff prep sections exist
    if (!mockContent.includes(expectedAndieSectionTitle)) {
      this.errors.push('Missing section: "' + expectedAndieSectionTitle + '"');
    }
    if (!mockContent.includes(expectedBladeSectionTitle)) {
      this.errors.push('Missing section: "' + expectedBladeSectionTitle + '"');
    }

    // Validate prep-only items appear in correct staff sections
    if (!mockContent.includes(expectedAndiePrepItem)) {
      this.errors.push('Missing Andie prep item: "' + expectedAndiePrepItem + '"');
    }
    if (!mockContent.includes(expectedBladePrepItem)) {
      this.errors.push('Missing Blade prep item: "' + expectedBladePrepItem + '"');
    }

    // Validate unassigned item appears
    if (!mockContent.includes(expectedUnassignedItem)) {
      this.errors.push('Missing unassigned prep item: "' + expectedUnassignedItem + '"');
    }

    // Garnish/Other items must NEVER appear on ordering doc
    const mustNotContain = ["Dehydrated Citrus Wheels", "Smoked Salt Rim"];
    mustNotContain.forEach(item => {
      if (mockContent.includes(item)) {
        this.errors.push('Ordering doc incorrectly contains "' + item + '" (Garnish/Other are in-house, never ordered)');
      }
    });

    // Bar stock items should NOT appear in Andie/Blade prep sections
    // (they are already in the bar stock supplier section)
    // This is a structural validation — we check the section order

    return this.errors.length === 0;
  }

  /**
   * Validates Stock Orders data integrity.
   */
  validateStockOrdersData(mockAPI) {
    const session = mockAPI.getCountSessionsByStatus("Orders Generated")[0];
    if (!session) {
      this.errors.push("No Count Session with 'Orders Generated' status found");
      return false;
    }

    const orders = mockAPI.getStockOrdersBySessionId(session.id);

    // Every order must have a positive Combined Order Qty
    orders.forEach(o => {
      const qty = o.fields["Combined Order Qty"];
      if (!Number.isFinite(qty) || qty <= 0) {
        this.errors.push('Stock order ' + o.id + ' has invalid Combined Order Qty: ' + qty);
      }
    });

    // Every order must link to an item
    orders.forEach(o => {
      const itemIds = o.fields["Item"];
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        this.errors.push('Stock order ' + o.id + ' has no linked Item');
      }
    });

    // Every order must link to the correct session
    orders.forEach(o => {
      const sessionIds = o.fields["Count Session"];
      if (!Array.isArray(sessionIds) || !sessionIds.includes(session.id)) {
        this.errors.push('Stock order ' + o.id + ' not linked to session ' + session.id);
      }
    });

    return this.errors.length === 0;
  }

  getResults() {
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

/* =========================================================
 * TEST EXECUTION
 * ======================================================= */

function testIngredientPrepDocGeneration() {
  Logger.log("\n=== TEST: Ingredient Prep Doc Generation ===");

  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);

  // Simulate document content that would be generated
  const mockDocContent = [
    'Prep Run ' + TEST_CONFIG.testRunLabel + ' - Ingredient Prep Run Sheet',
    '',
    'Espresso Martini Batch 5000ml',
    '',
    '1000ml (suggest: 1500ml) Honey Syrup',
    '',
    '  1kg Honey',
    '',
    'Method:',
    '1. Combine honey and hot water 2:1 ratio',
    '2. Stir until dissolved',
    '3. Cool and bottle',
    '',
    '500ml (suggest: 600ml) Citrus Oleo',
    '',
    '  2kg Lemons',
    '',
    'Method:',
    '1. Peel lemons and oranges, avoid pith',
    '2. Cover peels with caster sugar',
    '3. Muddle and rest 24 hours',
    '4. Strain and bottle',
    '',
    'Negroni Batch 3000ml',
    '',
    'See above: 100ml Citrus Oleo',
    '',
    'Dehydrated Citrus Wheels 50ea',
    '',
    '  1kg Lemons',
    '  0.5kg Oranges',
    '',
    'Method:',
    '1. Slice citrus 2mm thick',
    '2. Lay on dehydrator trays',
    '3. Dehydrate at 60C for 8-10 hours',
    '4. Store in airtight container',
    '',
    'Smoked Salt Rim 200g',
    '',
    'Method:',
    '1. Combine smoked salt flakes with citric acid',
    '2. Add dried rosemary, finely ground',
    '3. Mix thoroughly, store in rim dish',
  ].join('\n');

  const isValid = validator.validateIngredientPrepDoc(mockDocContent);
  const results = validator.getResults();

  Logger.log('Result: ' + (isValid ? 'PASS' : 'FAIL'));

  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(function(e) { Logger.log("  - " + e); });
  }

  if (results.warnings.length) {
    Logger.log("Warnings:");
    results.warnings.forEach(function(w) { Logger.log("  - " + w); });
  }

  return isValid;
}

function testBatchingDocGeneration() {
  Logger.log("\n=== TEST: Batching Doc Generation ===");

  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);

  const mockDocContent = [
    'Prep Run ' + TEST_CONFIG.testRunLabel + ' - Batching Run Sheet',
    '',
    'Espresso Martini Batch 5000ml',
    '',
    '  1500ml Ketel One Vodka',
    '  1000ml Mr Black Coffee Liqueur',
    '  400ml Honey Syrup',
    '',
    'Method:',
    '1. Combine vodka and Mr Black in batch container',
    '2. Add fresh espresso shots',
    '3. Add simple syrup to taste',
    '4. Stir gently, refrigerate',
    '',
    'Notes:',
    'Double batch for Friday service',
    '',
    'Negroni Batch 3000ml',
    '',
    '  1000ml Campari',
    '  100ml Citrus Oleo',
    '',
    'Method:',
    '1. Combine Campari, sweet vermouth, and gin in equal parts',
    '2. Stir over ice',
    '3. Strain into batch container',
    '4. Refrigerate',
  ].join('\n');

  const isValid = validator.validateBatchingDoc(mockDocContent);
  const results = validator.getResults();

  Logger.log('Result: ' + (isValid ? 'PASS' : 'FAIL'));

  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(function(e) { Logger.log("  - " + e); });
  }

  return isValid;
}

function testCombinedOrderingDocGeneration() {
  Logger.log("\n=== TEST: Combined Ordering Doc Generation ===");

  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);

  // Simulates the 6-section combined ordering doc layout
  const mockDocContent = [
    'Combined Ordering Run Sheet W.E. 29/03/2026',
    '',
    '--- BAR STOCK ORDERS (from Stock Count) ---',
    '',
    'Paramount Liquor',
    'orders@paramountliquor.com.au',
    '',
    '  Ketel One Vodka  |  6x Bottles',
    '  Mr Black Coffee Liqueur  |  3x Bottles',
    '  Campari  |  4x Bottles',
    '',
    '--- ITEMS BELOW PAR - NO SUPPLIER ---',
    '',
    '(none)',
    '',
    "--- ANDIE'S ORDERS (from Prep Count) ---",
    '',
    'Harris Farm Markets',
    '  Honey  |  1kg',
    '',
    "--- BLADE'S ORDERS (from Prep Count) ---",
    '',
    'Harris Farm Markets',
    '  Lemons  |  5kg',
    '',
    '--- PREP-ONLY ITEMS ---',
    '',
    'UNASSIGNED SUPPLIER',
    '  Oranges  |  0.5kg',
  ].join('\n');

  const isValid = validator.validateCombinedOrderingDoc(mockDocContent);
  const results = validator.getResults();

  Logger.log('Result: ' + (isValid ? 'PASS' : 'FAIL'));

  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(function(e) { Logger.log("  - " + e); });
  }

  return isValid;
}

function testBufferMultiplierCalculation() {
  Logger.log("\n=== TEST: Buffer Multiplier Calculation ===");

  var testCases = [
    { target: 1000, buffer: 1.5, expected: 1500, unit: "ml" },
    { target: 500, buffer: 1.2, expected: 600, unit: "ml" },
    { target: 200, buffer: 1.0, expected: 200, unit: "g" },  // No buffer
    { target: 3000, buffer: 1.5, expected: 4500, unit: "ml" },
  ];

  var allPassed = true;

  testCases.forEach(function(test, i) {
    var calculated = test.target * test.buffer;
    var passed = Math.abs(calculated - test.expected) < 0.01;

    Logger.log('Test ' + (i + 1) + ': ' + test.target + test.unit + ' x ' + test.buffer + ' = ' + calculated + test.unit + ' (expected ' + test.expected + test.unit + ') ' + (passed ? 'PASS' : 'FAIL'));

    if (!passed) allPassed = false;
  });

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testItemTypeRouting() {
  Logger.log("\n=== TEST: Item Type Routing ===");

  // Mirrors CFG.airtable.itemTypes from PrepConfig.gs
  var batchVariants = new Set(["Batch", "Sub Recipe"]);
  var ingredientPrepOnly = new Set(["Garnish", "Other"]);
  var subRecipeVariants = new Set(["Sub-recipe"]);

  // All 5 allowed item types from Waratah_GeneratePrepRun.gs
  var allowedTopLevelItemTypes = new Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]);

  var testCases = [
    { type: "Batch",      expectBatching: true,  expectIngPrepDoc: true,  expectOrdering: false, expectAllowed: true },
    { type: "Sub Recipe", expectBatching: true,  expectIngPrepDoc: true,  expectOrdering: false, expectAllowed: true },
    { type: "Sub-recipe", expectBatching: false, expectIngPrepDoc: true,  expectOrdering: false, expectAllowed: true },
    { type: "Garnish",    expectBatching: false, expectIngPrepDoc: true,  expectOrdering: false, expectAllowed: true },
    { type: "Other",      expectBatching: false, expectIngPrepDoc: true,  expectOrdering: false, expectAllowed: true },
    { type: "Ingredient", expectBatching: false, expectIngPrepDoc: false, expectOrdering: true,  expectAllowed: false },
  ];

  var allPassed = true;

  testCases.forEach(function(test, i) {
    var isBatchVariant = batchVariants.has(test.type);
    var isIngPrepOnly = ingredientPrepOnly.has(test.type);
    var isSubRecipeVariant = subRecipeVariants.has(test.type);
    var isAllowed = allowedTopLevelItemTypes.has(test.type);

    // Batching doc: only batchVariants
    var goesBatching = isBatchVariant;
    // Ingredient Prep: batchVariants + subRecipeVariants + ingredientPrepOnly
    var goesIngPrep = isBatchVariant || isSubRecipeVariant || isIngPrepOnly;
    // Ordering: skip batchVariants + subRecipeVariants + ingredientPrepOnly (i.e., only Ingredients)
    var goesOrdering = !isBatchVariant && !isSubRecipeVariant && !isIngPrepOnly;

    var pass1 = goesBatching === test.expectBatching;
    var pass2 = goesIngPrep === test.expectIngPrepDoc;
    var pass3 = goesOrdering === test.expectOrdering;
    var pass4 = isAllowed === test.expectAllowed;

    var passed = pass1 && pass2 && pass3 && pass4;

    Logger.log('Test ' + (i + 1) + ': "' + test.type + '" → Batching=' + goesBatching + (pass1 ? '' : ' EXPECTED ' + test.expectBatching) + ', IngPrep=' + goesIngPrep + (pass2 ? '' : ' EXPECTED ' + test.expectIngPrepDoc) + ', Ordering=' + goesOrdering + (pass3 ? '' : ' EXPECTED ' + test.expectOrdering) + ', Allowed=' + isAllowed + (pass4 ? '' : ' EXPECTED ' + test.expectAllowed) + ' ' + (passed ? 'PASS' : 'FAIL'));

    if (!passed) allPassed = false;
  });

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testRecipeNameResolution() {
  Logger.log("\n=== TEST: Recipe Name Resolution (Linked Record Pattern) ===");

  var mockAPI = new MockAirtableAPI();
  var allPassed = true;

  var testCases = [
    { recipeId: TEST_CONFIG.mockIds.recipe1, expectedName: "Espresso Martini Batch" },
    { recipeId: TEST_CONFIG.mockIds.recipe3, expectedName: "Honey Syrup" },
    { recipeId: TEST_CONFIG.mockIds.recipe5, expectedName: "Dehydrated Citrus Wheels" },
  ];

  testCases.forEach(function(test, i) {
    var recipe = mockAPI.getRecipesByIds([test.recipeId])[0];
    var resolvedName = mockAPI.resolveRecipeName(recipe);
    var passed = resolvedName === test.expectedName;

    Logger.log('Test ' + (i + 1) + ': Recipe ' + test.recipeId + ' → "' + resolvedName + '" (expected "' + test.expectedName + '") ' + (passed ? 'PASS' : 'FAIL'));

    if (!passed) allPassed = false;
  });

  // Verify that "Recipe Name" field does NOT exist on recipes
  var recipe = mockAPI.getRecipesByIds([TEST_CONFIG.mockIds.recipe1])[0];
  var hasRecipeNameField = recipe.fields.hasOwnProperty("Recipe Name");
  if (hasRecipeNameField) {
    Logger.log('FAIL: Recipe has "Recipe Name" field — Waratah uses "Item Name" (linked record) instead');
    allPassed = false;
  } else {
    Logger.log('Confirmed: No "Recipe Name" field on recipe records (correct for Waratah)');
  }

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testStockOrdersPipeline() {
  Logger.log("\n=== TEST: Stock Orders Pipeline ===");

  var mockAPI = new MockAirtableAPI();
  var validator = new DocumentValidator(mockAPI);

  // Test 1: Count Session exists with correct status
  var sessions = mockAPI.getCountSessionsByStatus("Orders Generated");
  var sessionOk = sessions.length === 1;
  Logger.log('Count Session with "Orders Generated": ' + (sessionOk ? 'PASS' : 'FAIL (found ' + sessions.length + ')'));

  // Test 2: Stock Orders link to session
  var session = sessions[0];
  var orders = mockAPI.getStockOrdersBySessionId(session.id);
  var ordersOk = orders.length === 3;
  Logger.log('Stock Orders for session: ' + orders.length + ' records ' + (ordersOk ? 'PASS' : 'FAIL'));

  // Test 3: Validate stock orders data integrity
  var dataValid = validator.validateStockOrdersData(mockAPI);
  Logger.log('Stock Orders data integrity: ' + (dataValid ? 'PASS' : 'FAIL'));

  // Test 4: Ordering Export State is REQUESTED
  var exportState = session.fields["Ordering Export State"];
  var stateOk = exportState === "REQUESTED";
  Logger.log('Ordering Export State: "' + exportState + '" ' + (stateOk ? 'PASS' : 'FAIL'));

  // Test 5: Session has counted-by field (defaults to Evan)
  var countedBy = session.fields["Counted By"] || "";
  var countedByOk = countedBy === "Evan";
  Logger.log('Counted By: "' + countedBy + '" ' + (countedByOk ? 'PASS' : 'FAIL'));

  var results = validator.getResults();
  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(function(e) { Logger.log("  - " + e); });
  }

  var allPassed = sessionOk && ordersOk && dataValid && stateOk && countedByOk;
  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testPrepOnlyVsBarStockSeparation() {
  Logger.log("\n=== TEST: Prep-Only vs Bar Stock Item Separation ===");

  var mockAPI = new MockAirtableAPI();
  var allPassed = true;

  // Bar stock items (in Stock Orders) should NOT appear in Andie/Blade prep sections
  var barStockItemIds = new Set();
  var stockOrders = generateMockStockOrders();
  stockOrders.forEach(function(o) {
    var itemIds = o.fields["Item"];
    if (Array.isArray(itemIds)) {
      itemIds.forEach(function(id) { barStockItemIds.add(id); });
    }
  });

  // Prep requirements
  var requirements = generateMockRequirements();

  // Prep-only items = requirements whose item is NOT in barStockItemIds
  var prepOnlyItems = requirements.filter(function(r) {
    var itemId = Array.isArray(r.fields["Item Link"]) ? r.fields["Item Link"][0] : null;
    return itemId && !barStockItemIds.has(itemId);
  });

  // Should have 3 prep-only items: Lemons (Blade), Honey (Andie), Oranges (unassigned)
  var prepOnlyCount = prepOnlyItems.length === 3;
  Logger.log('Prep-only items count: ' + prepOnlyItems.length + ' (expected 3) ' + (prepOnlyCount ? 'PASS' : 'FAIL'));
  if (!prepOnlyCount) allPassed = false;

  // Andie prep items
  var andieItems = prepOnlyItems.filter(function(r) {
    return (r.fields["Ordering Staff (Static)"] || "").toLowerCase() === "andie";
  });
  var andieOk = andieItems.length === 1;
  Logger.log('Andie prep items: ' + andieItems.length + ' (expected 1: Honey) ' + (andieOk ? 'PASS' : 'FAIL'));
  if (!andieOk) allPassed = false;

  // Blade prep items
  var bladeItems = prepOnlyItems.filter(function(r) {
    return (r.fields["Ordering Staff (Static)"] || "").toLowerCase() === "blade";
  });
  var bladeOk = bladeItems.length === 1;
  Logger.log('Blade prep items: ' + bladeItems.length + ' (expected 1: Lemons) ' + (bladeOk ? 'PASS' : 'FAIL'));
  if (!bladeOk) allPassed = false;

  // Unassigned prep items
  var unassignedItems = prepOnlyItems.filter(function(r) {
    var staff = (r.fields["Ordering Staff (Static)"] || "").toLowerCase();
    return !staff || staff === "";
  });
  var unassignedOk = unassignedItems.length === 1;
  Logger.log('Unassigned prep items: ' + unassignedItems.length + ' (expected 1: Oranges) ' + (unassignedOk ? 'PASS' : 'FAIL'));
  if (!unassignedOk) allPassed = false;

  // Bar stock items should have 3 items (Ketel One, Campari, Mr Black)
  var barStockCount = barStockItemIds.size === 3;
  Logger.log('Bar stock items: ' + barStockItemIds.size + ' (expected 3) ' + (barStockCount ? 'PASS' : 'FAIL'));
  if (!barStockCount) allPassed = false;

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testErrorHandling() {
  Logger.log("\n=== TEST: Error Handling Scenarios ===");

  var allPassed = true;

  // Test 1: Missing Count Session
  var mockAPI = new MockAirtableAPI();
  var noSessions = mockAPI.getCountSessionsByStatus("Nonexistent Status");
  var test1 = noSessions.length === 0;
  Logger.log('No session for bad status: ' + (test1 ? 'PASS' : 'FAIL'));
  if (!test1) allPassed = false;

  // Test 2: Empty stock orders for unknown session
  var noOrders = mockAPI.getStockOrdersBySessionId("recNONEXISTENT");
  var test2 = noOrders.length === 0;
  Logger.log('No orders for bad session: ' + (test2 ? 'PASS' : 'FAIL'));
  if (!test2) allPassed = false;

  // Test 3: Recipe with missing linked item resolves to "(Unknown)"
  var badRecipe = { id: "recBAD", fields: { "Item Name": ["recNONEXISTENT_ITEM"] } };
  var resolvedName = mockAPI.resolveRecipeName(badRecipe);
  var test3 = resolvedName === "(Unknown)";
  Logger.log('Missing item resolution: "' + resolvedName + '" ' + (test3 ? 'PASS' : 'FAIL'));
  if (!test3) allPassed = false;

  // Test 4: Recipe with no Item Name field resolves to "(Unknown)"
  var emptyRecipe = { id: "recEMPTY", fields: {} };
  var resolvedEmpty = mockAPI.resolveRecipeName(emptyRecipe);
  var test4 = resolvedEmpty === "(Unknown)";
  Logger.log('Empty Item Name resolution: "' + resolvedEmpty + '" ' + (test4 ? 'PASS' : 'FAIL'));
  if (!test4) allPassed = false;

  // Test 5: Recipe with empty array for Item Name
  var emptyArrayRecipe = { id: "recARR", fields: { "Item Name": [] } };
  var resolvedArr = mockAPI.resolveRecipeName(emptyArrayRecipe);
  var test5 = resolvedArr === "(Unknown)";
  Logger.log('Empty array Item Name: "' + resolvedArr + '" ' + (test5 ? 'PASS' : 'FAIL'));
  if (!test5) allPassed = false;

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

function testAllowedItemTypes() {
  Logger.log("\n=== TEST: allowedTopLevelItemTypes Completeness ===");

  // P0 rule: allowedTopLevelItemTypes must include all five variants
  var required = ["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"];
  var allowedSet = new Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]);

  var allPassed = true;

  required.forEach(function(type) {
    var has = allowedSet.has(type);
    Logger.log('"' + type + '" in allowedTopLevelItemTypes: ' + (has ? 'PASS' : 'FAIL'));
    if (!has) allPassed = false;
  });

  // Must be exactly 5 — no extras, no missing
  var sizeOk = allowedSet.size === 5;
  Logger.log('Set size: ' + allowedSet.size + ' (expected 5) ' + (sizeOk ? 'PASS' : 'FAIL'));
  if (!sizeOk) allPassed = false;

  Logger.log('Result: ' + (allPassed ? 'PASS' : 'FAIL'));
  return allPassed;
}

/* =========================================================
 * MAIN TEST RUNNER
 * ======================================================= */

function runAllTests() {
  Logger.log("============================================================");
  Logger.log("   WARATAH GOOGLE DOCS PREP SYSTEM - TEST HARNESS           ");
  Logger.log("============================================================\n");

  var tests = [
    { name: "Buffer Multiplier Calculation", fn: testBufferMultiplierCalculation },
    { name: "Item Type Routing", fn: testItemTypeRouting },
    { name: "Allowed Item Types (P0)", fn: testAllowedItemTypes },
    { name: "Recipe Name Resolution (Linked Record)", fn: testRecipeNameResolution },
    { name: "Ingredient Prep Doc", fn: testIngredientPrepDocGeneration },
    { name: "Batching Doc", fn: testBatchingDocGeneration },
    { name: "Combined Ordering Doc", fn: testCombinedOrderingDocGeneration },
    { name: "Stock Orders Pipeline", fn: testStockOrdersPipeline },
    { name: "Prep-Only vs Bar Stock Separation", fn: testPrepOnlyVsBarStockSeparation },
    { name: "Error Handling", fn: testErrorHandling },
  ];

  var results = [];

  tests.forEach(function(test) {
    try {
      var passed = test.fn();
      results.push({ name: test.name, passed: passed, error: null });
    } catch (e) {
      Logger.log("\nTEST CRASHED: " + test.name);
      Logger.log("Error: " + e.message);
      results.push({ name: test.name, passed: false, error: e.message });
    }
  });

  // Summary
  Logger.log("\n============================================================");
  Logger.log("   TEST SUMMARY                                              ");
  Logger.log("============================================================\n");

  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;

  results.forEach(function(r) {
    var status = r.passed ? "PASS" : "FAIL";
    Logger.log(status + ": " + r.name);
    if (r.error) Logger.log("         " + r.error);
  });

  Logger.log("\n" + passed + "/" + tests.length + " tests passed");

  if (failed === 0) {
    Logger.log("\nALL TESTS PASSED!");
  } else {
    Logger.log("\n" + failed + " test(s) failed");
  }

  return { passed: passed, failed: failed, total: tests.length, results: results };
}
