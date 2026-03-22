/****************************************************
 * PREP SYSTEM — CONFIGURATION
 * Part of the GoogleDocsPrepSystem split (PrepConfig.gs)
 ****************************************************/

const CFG = {
  timezone: "Australia/Sydney",

  props: {
    airtableBaseId: "AIRTABLE_BASE_ID",
    airtablePat: "AIRTABLE_PAT",
    docsFolderId: "DOCS_FOLDER_ID",

    slackPrep: "SLACK_WEBHOOK_PREP",
    slackWaratahTest: "SLACK_WEBHOOK_WARATAH_TEST",
    manualTriggerSecret: "MANUAL_TRIGGER_SECRET",
    recipeScalerUrl: "RECIPE_SCALER_URL",

    templateOrderingCombined: "WARATAH_TEMPLATE_ORDERING_ID",
    templateBatching: "WARATAH_TEMPLATE_BATCHING_ID",
    templateIngredientPrep: "WARATAH_TEMPLATE_INGREDIENT_PREP_ID",
    feedbackFormUrl: "FEEDBACK_FORM_URL",
  },

  airtable: {
    tables: {
      runs: "Prep Runs",
      tasks: "Prep Tasks",
      reqs: "Ingredient Requirements",
      items: "Items",
      recipes: "Recipes",
      recipeLines: "Recipe Lines",
      supplier: "Supplier",
      parLevels: "Par Levels",
      weeklyCounts: "Weekly Counts",
      stockOrders: "Stock Orders",
      countSessions: "Count Sessions",
    },

    fields: {
      runPrepWeek: "Prep Week",
      runNotes: "Notes / Handover Notes",
      runLinkToGuides: "Link to Prep Guides",
      runTasksLinkBack: "Prep Tasks",
      runReqsLinkBack: "Ingredient Requirements",

      taskItem: "Item Needed",
      taskRecipe: "Recipe Used",
      taskTarget: "Target Qty",
      taskBatches: "Batches Needed",
      taskSuggestedQty: "Suggested Qty (Buffer)",
      taskNotes: "Notes",

      reqItem: "Item Link",
      reqQty: "Total Qty Needed",
      reqSupplierNameStatic: "Supplier Name (Static)",
      reqStaffStatic: "Ordering Staff (Static)",
      reqSupplierLink: "Supplier",
      reqOrderingStaff: "Ordering Staff",

      itemName: "Item Name",
      itemType: "Item Type",
      itemUnit: "Unit",

      recipeName: "Item Name",  // Waratah uses linked record "Item Name", not "Recipe Name"
      recipeMethod: "Method",

      rlRecipe: "Recipe",
      rlItem: "Item",
      rlQty: "Qty",

      // Par Levels table fields
      parItem: "Item Link",
      parQty: "Prep Qty",

      // Weekly Counts table fields
      wcItem: "Item",
      wcStockCount: "Stock Count",
      wcConfirmed: "Confirmed",
      wcCountDate: "Count Date",

      supplierName: "Supplier Name",
      supplierOrderingStaff: "Ordering Staff",
      supplierEmail: "Email",

      // Stock Orders fields (populated by Waratah_GenerateStockOrders.gs)
      soItem: "Item",                          // linked record → Items
      soSession: "Count Session",              // linked record → Count Sessions
      soOnHand: "Total On Hand",
      soPrepUsage: "Prep Usage",
      soParQty: "Prep Qty",
      soServiceShortfall: "Service Shortfall",
      soCombinedQty: "Combined Order Qty",
      soSupplierStatic: "Supplier Name (Static)",
      soCategoryStatic: "Product Category (Static)",
      soStaffStatic: "Ordering Staff (Static)",
      soStatus: "Status",

      // Count Sessions fields
      csStatus: "Status",
      csDate: "Session Date",
      csName: "Session Name",
      csCountedBy: "Counted By",
      csOrderingExportState: "Ordering Export State",  // Single select: REQUESTED / COMPLETED / ERROR

      // Items — Bar Stock flag (used by combined ordering to identify prep-only items)
      itemBarStock: "Bar Stock",
    },

    itemTypes: {
      batch: "Batch",           // Batching List only
      subRecipe: "Sub Recipe",  // Ingredient Prep List only
      subRecipeVariants: new Set(["Sub-recipe"]),
      // Both "Batch" and "Sub Recipe" items appear in the Batching List + Ingredient Prep List docs.
      // Used in ordering filter to skip in-house items.
      batchVariants: new Set(["Batch", "Sub Recipe"]),
      // Garnish and Other items appear in the Ingredient Prep List (not Batching List, not ordering).
      ingredientPrepOnly: new Set(["Garnish", "Other"]),
    },

  },

  bufferMultiplier: 1.5,
};

let SLACK_WEBHOOK_OVERRIDE = null;
let RUN_ID_OVERRIDE = null;
let SKIP_SLACK = false;
