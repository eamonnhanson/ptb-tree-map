export const OWN_TREE_WORKFLOW = Object.freeze({
  key: "shopify_own_tree_sku02", zapId: "374807250", name: "Zap C - Shopify naar PostgreSQL en Creator - SKU 02",
  trigger: "Shopify New Paid Order", filter: "Line Item SKU exactly matches 02", correlation: "Shopify Order ID → trees1.order_id", expectedQuantity: "Shopify Line Item Quantity",
  steps: ["PostgreSQL: Gebruiker aanmaken of bijwerken", "PostgreSQL: Bomen atomair toewijzen", "Code: Boomgegevens voor Zoho", "Quantity check, date formatter, and Zoho Creator"],
  failureGuide: [["No PostgreSQL allocation", "The customer bought trees, but the console cannot find trees linked to this Shopify order.", "Check Productfilter, Step 3, and Step 4."], ["Quantity mismatch", "Shopify and PostgreSQL show different numbers of trees for this order.", "Compare Shopify quantity, Step 4, and trees1 rows."], ["No user", "The workflow could not connect the Shopify customer to a PostgreSQL user.", "Check Step 3."], ["Insufficient free trees", "The workflow did not have enough free trees to allocate the requested number.", "Check available unclaimed trees before changing anything."]]
});
