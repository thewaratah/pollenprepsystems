/****************************************************
 * SAKURA HOUSE PREP SYSTEM — CONFIGURATION
 * Part of the GoogleDocsPrepSystem split (PrepConfig.gs)
 ****************************************************/

const CFG = {
  timezone: "Australia/Sydney",

  props: {
    airtableBaseId: "AIRTABLE_BASE_ID",
    airtablePat: "AIRTABLE_PAT",
    docsFolderId: "DOCS_FOLDER_ID",

    slackKalisha: "SLACK_WEBHOOK_KALISHA",
    slackEvan: "SLACK_WEBHOOK_EVAN",
    slackGooch: "SLACK_WEBHOOK_GOOCH",
    slackSabs: "SLACK_WEBHOOK_SABS",
    slackPrep: "SLACK_WEBHOOK_PREP",
    slackEvTest: "SLACK_WEBHOOK_EV_TEST",
    manualTriggerSecret: "MANUAL_TRIGGER_SECRET",
    recipeScalerUrl: "RECIPE_SCALER_URL",

    templateOrdering: "TEMPLATE_ORDERING_ID",
    templateBatching: "TEMPLATE_BATCHING_ID",
    templateIngredientPrep: "TEMPLATE_INGREDIENT_PREP_ID",
    feedbackFormUrl: "FEEDBACK_FORM_URL",
    supplierSheetUrl: "SUPPLIER_SHEET_URL",
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
      reqOrderSize: "Order Size (Lookup)",

      itemName: "Item Name",
      itemType: "Item Type",
      itemUnit: "Unit",

      recipeName: "Recipe Name",
      recipeMethod: "Method",

      rlRecipe: "Recipe",
      rlItem: "Item",
      rlQty: "Qty",

      supplierName: "Supplier Name",
      supplierOrderingStaff: "Ordering Staff",
      supplierEmail: "Email",
    },

    itemTypes: {
      batch: "Batch",
      subRecipeVariants: new Set(["Sub Recipe", "Sub-recipe"]),
    },

    staffAliases: {
      gooch: ["gooch"],
      sabs: ["sabs", "sabine"],
    },
  },

  bufferMultiplier: 1.5,
  negligibleRatioThreshold: 0.05, // Items using ≤5% of their order unit size are flagged as negligible
};

let SLACK_WEBHOOK_OVERRIDE = null;
let RUN_ID_OVERRIDE = null;
let SKIP_SLACK = false;
