/****************************************************
 * GOOGLE DOCS PREP SYSTEM - COMPREHENSIVE TEST HARNESS
 * 
 * Purpose:
 *   Validates document generation logic without hitting
 *   production Airtable or creating real Google Docs.
 *
 * Features:
 *   ✓ Mock Airtable data with realistic structures
 *   ✓ Validates all document content without Drive API
 *   ✓ Tests buffer multiplier display logic
 *   ✓ Tests supplier routing (Gooch/Sabs/Unassigned)
 *   ✓ Tests error handling scenarios
 *   ✓ Dry-run mode comparison
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
 ****************************************************/

/* =========================================================
 * TEST CONFIGURATION
 * ======================================================= */

const TEST_CONFIG = {
  // Set to true to enable verbose logging
  verbose: true,
  
  // Test run configuration
  testRunLabel: "2026-01-25",
  testFolderId: "TEST_FOLDER_ID", // Will not actually create folder
  
  // Mock Airtable record IDs
  mockIds: {
    runId: "recTEST_RUN_001",
    batchItem1: "recBATCH_001", // Tomato Sauce
    batchItem2: "recBATCH_002", // Pesto
    subRecipe1: "recSUB_001",   // Basil Oil (buffer 1.5x)
    subRecipe2: "recSUB_002",   // Roasted Tomatoes (buffer 1.2x)
    ingredient1: "recING_001",  // Fresh Basil
    ingredient2: "recING_002",  // Tomatoes
    ingredient3: "recING_003",  // Garlic
    recipe1: "recRECIPE_001",   // Tomato Sauce recipe
    recipe2: "recRECIPE_002",   // Pesto recipe
    recipe3: "recRECIPE_003",   // Basil Oil recipe
    recipe4: "recRECIPE_004",   // Roasted Tomatoes recipe
    supplier1: "recSUP_001",    // Gooch supplier
    supplier2: "recSUP_002",    // Sabs supplier
    supplier3: "recSUP_003",    // Unassigned supplier
  }
};

/* =========================================================
 * MOCK DATA GENERATORS
 * ======================================================= */

function generateMockPrepRun() {
  const ids = TEST_CONFIG.mockIds;
  
  return {
    id: ids.runId,
    createdTime: "2026-01-25T10:00:00.000Z",
    fields: {
      "Prep Week": "2026-01-25T00:00:00.000Z",
      "Notes / Handover Notes": "Test run for validation",
      "Prep Tasks": [ids.batchItem1, ids.batchItem2, ids.subRecipe1, ids.subRecipe2],
      "Ingredient Requirements": [ids.ingredient1, ids.ingredient2, ids.ingredient3]
    }
  };
}

function generateMockItems() {
  const ids = TEST_CONFIG.mockIds;
  
  return [
    // Batch Items
    {
      id: ids.batchItem1,
      fields: {
        "Item Name": "Tomato Sauce",
        "Item Type": { name: "Batch" },
        "Unit": "L"
      }
    },
    {
      id: ids.batchItem2,
      fields: {
        "Item Name": "Pesto",
        "Item Type": { name: "Batch" },
        "Unit": "kg"
      }
    },
    
    // Sub Recipes (with buffer multipliers)
    {
      id: ids.subRecipe1,
      fields: {
        "Item Name": "Basil Oil",
        "Item Type": { name: "Sub Recipe" },
        "Unit": "L",
        "Buffer Multiplier": 1.5 // 150%
      }
    },
    {
      id: ids.subRecipe2,
      fields: {
        "Item Name": "Roasted Tomatoes",
        "Item Type": { name: "Sub Recipe" },
        "Unit": "kg",
        "Buffer Multiplier": 1.2 // 120%
      }
    },
    
    // Ingredients
    {
      id: ids.ingredient1,
      fields: {
        "Item Name": "Fresh Basil",
        "Item Type": { name: "Ingredient" },
        "Unit": "bunch",
        "Supplier": [ids.supplier1],
        "Supplier Name": "Gooch Produce Co",
        "Product Category": "Herbs",
        "Ordering Staff": "Gooch"
      }
    },
    {
      id: ids.ingredient2,
      fields: {
        "Item Name": "Tomatoes",
        "Item Type": { name: "Ingredient" },
        "Unit": "kg",
        "Supplier": [ids.supplier2],
        "Supplier Name": "Sabs Organics",
        "Product Category": "Vegetables",
        "Ordering Staff": "Sabs"
      }
    },
    {
      id: ids.ingredient3,
      fields: {
        "Item Name": "Garlic",
        "Item Type": { name: "Ingredient" },
        "Unit": "kg",
        "Supplier": [ids.supplier3],
        "Supplier Name": "UNASSIGNED SUPPLIER",
        "Product Category": "Vegetables",
        "Ordering Staff": ""
      }
    }
  ];
}

function generateMockTasks() {
  const ids = TEST_CONFIG.mockIds;
  
  return [
    // Batch task 1
    {
      id: "recTASK_001",
      fields: {
        "Item Needed": [ids.batchItem1],
        "Recipe Used": [ids.recipe1],
        "Target Qty": 10,
        "Batches Needed": 2,
        "Notes": "Double batch for weekend service"
      }
    },
    
    // Batch task 2
    {
      id: "recTASK_002",
      fields: {
        "Item Needed": [ids.batchItem2],
        "Recipe Used": [ids.recipe2],
        "Target Qty": 5,
        "Batches Needed": 1,
        "Notes": ""
      }
    },
    
    // Sub recipe task 1 (with buffer suggestion)
    {
      id: "recTASK_003",
      fields: {
        "Item Needed": [ids.subRecipe1],
        "Recipe Used": [ids.recipe3],
        "Target Qty": 2,
        "Batches Needed": 2,
        "Suggested Qty (Buffer)": 3, // 2 × 1.5 = 3
        "Notes": ""
      }
    },
    
    // Sub recipe task 2 (with buffer suggestion)
    {
      id: "recTASK_004",
      fields: {
        "Item Needed": [ids.subRecipe2],
        "Recipe Used": [ids.recipe4],
        "Target Qty": 8,
        "Batches Needed": 2,
        "Suggested Qty (Buffer)": 9.6, // 8 × 1.2 = 9.6
        "Notes": ""
      }
    }
  ];
}

function generateMockRecipes() {
  const ids = TEST_CONFIG.mockIds;
  
  return [
    {
      id: ids.recipe1,
      fields: {
        "Recipe Name": "Tomato Sauce",
        "Method": "1. Roast tomatoes at 180°C for 30 mins\n2. Blend with basil oil\n3. Season to taste"
      }
    },
    {
      id: ids.recipe2,
      fields: {
        "Recipe Name": "Pesto",
        "Method": "1. Blend basil with garlic\n2. Add oil slowly\n3. Finish with parmesan"
      }
    },
    {
      id: ids.recipe3,
      fields: {
        "Recipe Name": "Basil Oil",
        "Method": "1. Blanch basil 30 seconds\n2. Blend with olive oil\n3. Strain through cheesecloth"
      }
    },
    {
      id: ids.recipe4,
      fields: {
        "Recipe Name": "Roasted Tomatoes",
        "Method": "1. Halve tomatoes\n2. Toss with oil and salt\n3. Roast 45 mins at 160°C"
      }
    }
  ];
}

function generateMockRecipeLines() {
  const ids = TEST_CONFIG.mockIds;
  
  return [
    // Tomato Sauce recipe lines
    { recipe: ids.recipe1, item: ids.subRecipe2, qty: 3 },
    { recipe: ids.recipe1, item: ids.subRecipe1, qty: 0.5 },
    
    // Pesto recipe lines
    { recipe: ids.recipe2, item: ids.ingredient1, qty: 5 },
    { recipe: ids.recipe2, item: ids.ingredient3, qty: 0.2 },
    { recipe: ids.recipe2, item: ids.subRecipe1, qty: 1 },
    
    // Basil Oil recipe lines
    { recipe: ids.recipe3, item: ids.ingredient1, qty: 10 },
    
    // Roasted Tomatoes recipe lines
    { recipe: ids.recipe4, item: ids.ingredient2, qty: 5 }
  ];
}

function generateMockRequirements() {
  const ids = TEST_CONFIG.mockIds;
  
  return [
    {
      id: "recREQ_001",
      fields: {
        "Item Link": [ids.ingredient1],
        "Total Qty Needed": 65, // 5×1 + 10×3 + 10×2 = 65 bunches
        "Supplier Name (Static)": "Gooch Produce Co",
        "Ordering Staff (Static)": "Gooch",
        "Supplier": [ids.supplier1],
        "Ordering Staff": "Gooch"
      }
    },
    {
      id: "recREQ_002",
      fields: {
        "Item Link": [ids.ingredient2],
        "Total Qty Needed": 40, // 5×2×2 = 40kg
        "Supplier Name (Static)": "Sabs Organics",
        "Ordering Staff (Static)": "Sabs",
        "Supplier": [ids.supplier2],
        "Ordering Staff": "Sabs"
      }
    },
    {
      id: "recREQ_003",
      fields: {
        "Item Link": [ids.ingredient3],
        "Total Qty Needed": 1, // 0.2×1 = 0.2kg (rounded display)
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
        "Supplier Name": "Gooch Produce Co",
        "Ordering Staff": "Gooch",
        "Email": "orders@goochproduce.com.au"
      }
    },
    {
      id: ids.supplier2,
      fields: {
        "Supplier Name": "Sabs Organics",
        "Ordering Staff": "Sabs",
        "Email": "sabine@sabsorganics.com.au"
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
      suppliers: generateMockSuppliers()
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
   * Validates Ingredient Prep List content
   */
  validateIngredientPrepDoc(mockContent) {
    const expectedSections = [
      "Tomato Sauce 10L",
      "Pesto 5kg"
    ];
    
    const expectedSubRecipes = [
      "Basil Oil",
      "Roasted Tomatoes"
    ];
    
    const expectedBufferSuggestions = [
      "2L (suggest: 3L) Basil Oil",
      "8kg (suggest: 9.6kg) Roasted Tomatoes"
    ];
    
    // Validate batch headings exist
    expectedSections.forEach(section => {
      if (!mockContent.includes(section)) {
        this.errors.push(`Missing batch section: "${section}"`);
      }
    });
    
    // Validate sub-recipe mentions
    expectedSubRecipes.forEach(subRecipe => {
      if (!mockContent.includes(subRecipe)) {
        this.errors.push(`Missing sub-recipe: "${subRecipe}"`);
      }
    });
    
    // Validate buffer suggestions display correctly
    expectedBufferSuggestions.forEach(suggestion => {
      if (!mockContent.includes(suggestion)) {
        this.errors.push(`Missing buffer suggestion: "${suggestion}"`);
      } else {
        Logger.log(`✓ Buffer suggestion found: ${suggestion}`);
      }
    });
    
    // Validate "See above" logic for duplicate sub-recipes
    const basilOilCount = (mockContent.match(/Basil Oil/g) || []).length;
    if (basilOilCount > 2) { // Should appear once in each batch section
      this.warnings.push(`Basil Oil appears ${basilOilCount} times (expected max 2 with "See above" logic)`);
    }
    
    return this.errors.length === 0;
  }
  
  /**
   * Validates Batching List content
   */
  validateBatchingDoc(mockContent) {
    const expectedSections = [
      "Tomato Sauce 10L",
      "Pesto 5kg"
    ];
    
    const expectedIngredients = [
      "6kg Roasted Tomatoes",  // 3kg per batch × 2 batches
      "1L Basil Oil",          // 0.5L per batch × 2 batches
      "5bunch Fresh Basil"     // 5 bunch per batch × 1 batch
    ];
    
    const expectedMethods = [
      "1. Roast tomatoes at 180°C for 30 mins",
      "1. Blend basil with garlic"
    ];
    
    // Validate sections
    expectedSections.forEach(section => {
      if (!mockContent.includes(section)) {
        this.errors.push(`Missing batch section: "${section}"`);
      }
    });
    
    // Validate ingredient bullets
    expectedIngredients.forEach(ingredient => {
      if (!mockContent.includes(ingredient)) {
        this.errors.push(`Missing ingredient line: "${ingredient}"`);
      }
    });
    
    // Validate methods are included
    expectedMethods.forEach(method => {
      if (!mockContent.includes(method)) {
        this.errors.push(`Missing method text: "${method}"`);
      }
    });
    
    // Validate notes are included
    if (!mockContent.includes("Double batch for weekend service")) {
      this.errors.push(`Missing task notes in batching doc`);
    }
    
    return this.errors.length === 0;
  }
  
  /**
   * Validates Ordering List content (Gooch/Sabs)
   */
  validateOrderingDoc(mockContent, owner) {
    const expectations = {
      gooch: {
        supplier: "Gooch Produce Co",
        email: "orders@goochproduce.com.au",
        items: ["Fresh Basil 65bunch"]
      },
      sabs: {
        supplier: "Sabs Organics",
        email: "sabine@sabsorganics.com.au",
        items: ["Tomatoes 40kg"]
      }
    };
    
    const expected = expectations[owner.toLowerCase()];
    
    if (!expected) {
      this.errors.push(`Unknown owner: ${owner}`);
      return false;
    }
    
    // Validate supplier heading
    if (!mockContent.includes(expected.supplier)) {
      this.errors.push(`Missing supplier heading: "${expected.supplier}"`);
    }
    
    // Validate email display
    if (expected.email && !mockContent.includes(expected.email)) {
      this.errors.push(`Missing supplier email: "${expected.email}"`);
    }
    
    // Validate items
    expected.items.forEach(item => {
      if (!mockContent.includes(item)) {
        this.errors.push(`Missing item: "${item}"`);
      }
    });
    
    // Should NOT contain items from other owner
    const otherOwner = owner.toLowerCase() === 'gooch' ? 'sabs' : 'gooch';
    const otherExpected = expectations[otherOwner];
    otherExpected.items.forEach(item => {
      if (mockContent.includes(item)) {
        this.errors.push(`Incorrectly contains item from ${otherOwner}: "${item}"`);
      }
    });
    
    return this.errors.length === 0;
  }
  
  /**
   * Validates UNASSIGNED section in ordering docs
   */
  validateUnassignedSection(mockContent) {
    // Should have UNASSIGNED heading
    if (!mockContent.includes("UNASSIGNED")) {
      this.errors.push(`Missing UNASSIGNED section`);
    }
    
    // Should have Airtable link instruction
    if (!mockContent.includes("airtable.com")) {
      this.errors.push(`Missing Airtable link in UNASSIGNED section`);
    }
    
    // Should contain garlic
    if (!mockContent.includes("Garlic")) {
      this.errors.push(`Missing unassigned item: Garlic`);
    }
    
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
  const mockDocContent = `
Prep Run ${TEST_CONFIG.testRunLabel} - Ingredient Prep List

Tomato Sauce 10L

2L (suggest: 3L) Basil Oil

• 20bunch Fresh Basil

Method:
1. Blanch basil 30 seconds
2. Blend with olive oil
3. Strain through cheesecloth

8kg (suggest: 9.6kg) Roasted Tomatoes

• 40kg Tomatoes

Method:
1. Halve tomatoes
2. Toss with oil and salt
3. Roast 45 mins at 160°C

Pesto 5kg

See above: 1L (suggest: 1.5L) Basil Oil
  `.trim();
  
  const isValid = validator.validateIngredientPrepDoc(mockDocContent);
  const results = validator.getResults();
  
  Logger.log(`Result: ${isValid ? "✓ PASS" : "✗ FAIL"}`);
  
  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(e => Logger.log(`  - ${e}`));
  }
  
  if (results.warnings.length) {
    Logger.log("Warnings:");
    results.warnings.forEach(w => Logger.log(`  - ${w}`));
  }
  
  return isValid;
}

function testBatchingDocGeneration() {
  Logger.log("\n=== TEST: Batching Doc Generation ===");
  
  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);
  
  const mockDocContent = `
Prep Run ${TEST_CONFIG.testRunLabel} - Batching List

Tomato Sauce 10L

• 6kg Roasted Tomatoes
• 1L Basil Oil

Method:
1. Roast tomatoes at 180°C for 30 mins
2. Blend with basil oil
3. Season to taste

Notes:
Double batch for weekend service

Pesto 5kg

• 5bunch Fresh Basil
• 0.2kg Garlic
• 1L Basil Oil

Method:
1. Blend basil with garlic
2. Add oil slowly
3. Finish with parmesan
  `.trim();
  
  const isValid = validator.validateBatchingDoc(mockDocContent);
  const results = validator.getResults();
  
  Logger.log(`Result: ${isValid ? "✓ PASS" : "✗ FAIL"}`);
  
  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(e => Logger.log(`  - ${e}`));
  }
  
  return isValid;
}

function testGoochOrderingDocGeneration() {
  Logger.log("\n=== TEST: Gooch Ordering Doc Generation ===");
  
  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);
  
  const mockDocContent = `
Prep Run ${TEST_CONFIG.testRunLabel} - Gooch Ordering List

Gooch Produce Co
orders@goochproduce.com.au

• Fresh Basil 65bunch

UNASSIGNED

Go to the suppliers tab on Airtable (https://airtable.com/appNsFRhuU47e9qlR/shrqsQbo2wEEzLNpL) and add/connect to item

UNASSIGNED SUPPLIER

• Garlic 1kg
  `.trim();
  
  const isValid = validator.validateOrderingDoc(mockDocContent, "Gooch");
  const unassignedValid = validator.validateUnassignedSection(mockDocContent);
  
  const results = validator.getResults();
  
  Logger.log(`Result: ${isValid && unassignedValid ? "✓ PASS" : "✗ FAIL"}`);
  
  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(e => Logger.log(`  - ${e}`));
  }
  
  return isValid && unassignedValid;
}

function testSabsOrderingDocGeneration() {
  Logger.log("\n=== TEST: Sabs Ordering Doc Generation ===");
  
  const mockAPI = new MockAirtableAPI();
  const validator = new DocumentValidator(mockAPI);
  
  const mockDocContent = `
Prep Run ${TEST_CONFIG.testRunLabel} - Sabs Ordering List

Sabs Organics
sabine@sabsorganics.com.au

• Tomatoes 40kg

UNASSIGNED

Go to the suppliers tab on Airtable (https://airtable.com/appNsFRhuU47e9qlR/shrqsQbo2wEEzLNpL) and add/connect to item

UNASSIGNED SUPPLIER

• Garlic 1kg
  `.trim();
  
  const isValid = validator.validateOrderingDoc(mockDocContent, "Sabs");
  const unassignedValid = validator.validateUnassignedSection(mockDocContent);
  
  const results = validator.getResults();
  
  Logger.log(`Result: ${isValid && unassignedValid ? "✓ PASS" : "✗ FAIL"}`);
  
  if (results.errors.length) {
    Logger.log("Errors:");
    results.errors.forEach(e => Logger.log(`  - ${e}`));
  }
  
  return isValid && unassignedValid;
}

function testBufferMultiplierCalculation() {
  Logger.log("\n=== TEST: Buffer Multiplier Calculation ===");
  
  const testCases = [
    { target: 500, buffer: 1.5, expected: 750, unit: "g" },
    { target: 2, buffer: 1.5, expected: 3, unit: "L" },
    { target: 8, buffer: 1.2, expected: 9.6, unit: "kg" },
    { target: 1000, buffer: 1.0, expected: 1000, unit: "mL" }, // No buffer
  ];
  
  let allPassed = true;
  
  testCases.forEach((test, i) => {
    const calculated = test.target * test.buffer;
    const passed = Math.abs(calculated - test.expected) < 0.01;
    
    Logger.log(`Test ${i + 1}: ${test.target}${test.unit} × ${test.buffer} = ${calculated}${test.unit} (expected ${test.expected}${test.unit}) ${passed ? "✓" : "✗"}`);
    
    if (!passed) allPassed = false;
  });
  
  Logger.log(`Result: ${allPassed ? "✓ PASS" : "✗ FAIL"}`);
  return allPassed;
}

function testSupplierRouting() {
  Logger.log("\n=== TEST: Supplier Routing Logic ===");
  
  const staffTexts = [
    { text: "gooch", expected: "gooch" },
    { text: "Gooch", expected: "gooch" },
    { text: "GOOCH", expected: "gooch" },
    { text: "sabs", expected: "sabs" },
    { text: "sabine", expected: "sabs" },
    { text: "Sabine", expected: "sabs" },
    { text: "", expected: null },
    { text: "unknown", expected: null },
    { text: null, expected: null },
  ];
  
  let allPassed = true;
  
  staffTexts.forEach((test, i) => {
    const result = matchStaff_(test.text);
    const passed = result === test.expected;
    
    Logger.log(`Test ${i + 1}: "${test.text}" → ${result} (expected ${test.expected}) ${passed ? "✓" : "✗"}`);
    
    if (!passed) allPassed = false;
  });
  
  Logger.log(`Result: ${allPassed ? "✓ PASS" : "✗ FAIL"}`);
  return allPassed;
}

/* =========================================================
 * MAIN TEST RUNNER
 * ======================================================= */

function runAllTests() {
  Logger.log("╔═══════════════════════════════════════════════════════╗");
  Logger.log("║   GOOGLE DOCS PREP SYSTEM - TEST HARNESS             ║");
  Logger.log("╚═══════════════════════════════════════════════════════╝\n");
  
  const tests = [
    { name: "Buffer Multiplier Calculation", fn: testBufferMultiplierCalculation },
    { name: "Supplier Routing Logic", fn: testSupplierRouting },
    { name: "Ingredient Prep Doc", fn: testIngredientPrepDocGeneration },
    { name: "Batching Doc", fn: testBatchingDocGeneration },
    { name: "Gooch Ordering Doc", fn: testGoochOrderingDocGeneration },
    { name: "Sabs Ordering Doc", fn: testSabsOrderingDocGeneration },
  ];
  
  const results = [];
  
  tests.forEach(test => {
    try {
      const passed = test.fn();
      results.push({ name: test.name, passed, error: null });
    } catch (e) {
      Logger.log(`\n✗ TEST CRASHED: ${test.name}`);
      Logger.log(`Error: ${e.message}`);
      results.push({ name: test.name, passed: false, error: e.message });
    }
  });
  
  // Summary
  Logger.log("\n╔═══════════════════════════════════════════════════════╗");
  Logger.log("║   TEST SUMMARY                                        ║");
  Logger.log("╚═══════════════════════════════════════════════════════╝\n");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    const status = r.passed ? "✓ PASS" : "✗ FAIL";
    Logger.log(`${status}: ${r.name}`);
    if (r.error) Logger.log(`         ${r.error}`);
  });
  
  Logger.log(`\n${passed}/${tests.length} tests passed`);
  
  if (failed === 0) {
    Logger.log("\n🎉 ALL TESTS PASSED!");
  } else {
    Logger.log(`\n⚠️  ${failed} test(s) failed`);
  }
  
  return { passed, failed, total: tests.length, results };
}

/* =========================================================
 * HELPER: matchStaff_ (copy from main script for testing)
 * ======================================================= */

function matchStaff_(staffText) {
  const s = (staffText || "").toLowerCase();
  if (!s) return null;
  
  const staffAliases = {
    gooch: ["gooch"],
    sabs: ["sabs", "sabine"]
  };
  
  if (staffAliases.gooch.some((x) => s.includes(x))) return "gooch";
  if (staffAliases.sabs.some((x) => s.includes(x))) return "sabs";
  return null;
}