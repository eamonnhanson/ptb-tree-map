# Workflow audit gap report

| workflow_id | workflow_name | audit_classification | gap | recommendation |
| --- | --- | --- | --- | --- |
| zap_1 | IMCD_NL_TreeCert_Postgres | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_15 | IMCD_BEL_TreeCert_Postgres | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_29 | zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02) | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_47 | zap a- Shopify -> Tokenized Gift Tree Link (SKU 01) | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_61 | ZAP B | not_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_95 | Nieuw abonnes chargebee REVERTED | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_124 | Monthly Tree Report | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_129 | Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eénmalige e-mail | partially_audited | standardized final event status fields | add Zapier final logging step |
| zap_135 | (Copy) zap b multiple Eigenbomen SKU02 | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_141 | Nieuw abonnes shopify handmatig - zoho form | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_172 | Webhooks by Zapier | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| zap_175 | Trigger: New or Updated Contact in Zoho CRM | partially_audited | standardized final workflow/audit log row | add Zapier final logging step |
| shopify_sku_'01 | Shopify product: Geef een boom cadeau | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_'02 | Shopify product: Koop een boom (voor jezelf) | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_'05 | Shopify product: Doneer (eenmalig) | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_'03 | Shopify product: Persoons-abonnement | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_'04 | Shopify product: Gezins-abonnement | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_maandelijkse_donatie | Shopify product: Maandelijkse donatie | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_ | Shopify product: | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| shopify_sku_ | Shopify product: | unknown | No standardized event log tying source trigger to final result. | needs human verification |
| chargebee_plan_1-boom-per-maand-EUR-Monthly | Chargebee plan: 1-boom-per-maand-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_15-boom-per-maand-EUR-Monthly | Chargebee plan: 15-boom-per-maand-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_1-boom-per-maand-ingang-volgende-maand-EUR-Monthly | Chargebee plan: 1-boom-per-maand-ingang-volgende-maand-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_Maandelijkse-bijdrage-1250-euro-EUR-Monthly | Chargebee plan: Maandelijkse-bijdrage-1250-euro-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_750-9-bomen-abonnement-EUR-Monthly | Chargebee plan: 750-9-bomen-abonnement-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_20-euro-24-bomen-abonnement-EUR-Monthly | Chargebee plan: 20-euro-24-bomen-abonnement-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| chargebee_plan_12-5-euro-15-bomen-abonnement-EUR-Monthly | Chargebee plan: 12-5-euro-15-bomen-abonnement-EUR-Monthly | partially_audited | inferred_needs_verification | needs human verification |
| zoho_manual_followup_required | Zoho Mail signal: manual_followup_required | manual_only | Exact requested folders missing; sample paths used. | add Zoho Mail filter/folder/tag and matching rule |
| zoho_tree_allocated_email_seen | Zoho Mail signal: tree_allocated_email_seen | partially_audited | Exact requested folders missing; sample paths used. | add Zoho Mail filter/folder/tag and matching rule |
| zoho_onboarding_email_sent | Zoho Mail signal: onboarding_email_sent | partially_audited | Exact requested folders missing; sample paths used. | add Zoho Mail filter/folder/tag and matching rule |
| zoho_subscription_thank_you_sent | Zoho Mail signal: subscription_thank_you_sent | partially_audited | Exact requested folders missing; sample paths used. | add Zoho Mail filter/folder/tag and matching rule |
| zoho_certificate_email_seen | Zoho Mail signal: certificate_email_seen | partially_audited | Exact requested folders missing; sample paths used. | add Zoho Mail filter/folder/tag and matching rule |
