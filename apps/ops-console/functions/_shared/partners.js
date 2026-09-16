// Confirmed records only. This source-controlled list can later use a CRM adapter.
// Each record: id, name, type (business/foundation), relationship (supporter/prospect),
// target_eur, received_eur, next_action, owner, due_date (YYYY-MM-DD), instructions.
// Keep private contact details and agreements in the existing CRM.
export const partners = { configured: false, reviewed_at: null, records: [] };
