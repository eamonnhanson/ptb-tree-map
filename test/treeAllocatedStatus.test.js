import test from "node:test";
import assert from "node:assert/strict";
import { determineTreeAllocatedStatus } from "../netlify/functions/tree-allocated-status.js";

const now = new Date("2026-08-02T12:00:00Z");
const complete = {
  order_date: "2026-08-02T10:00:00Z", email: "klant@example.test", email_match_count: 1,
  user_id: 2978, ordered_count: 2, allocated_count: 2, mismatched_order_count: 0,
  creator_record_count: 1, email_submitted: true,
  shopify_source_available: true, creator_source_available: true
};

test("exact aantal, één GiftClaims-record en aangeboden gift-claim e-mail is afgerond", () => {
  const result = determineTreeAllocatedStatus(complete, now);
  assert.equal(result.status, "completed");
  assert.equal(result.label, "Gift-claim afgerond");
});

test("te weinig bomen geeft concrete actie", () => {
  const result = determineTreeAllocatedStatus({ ...complete, allocated_count: 1 }, now);
  assert.equal(result.status, "action_required");
  assert.deepEqual(result.reasons, ["1 van 2 bomen toegewezen"]);
});

test("te veel bomen geeft concrete actie", () => {
  const result = determineTreeAllocatedStatus({ ...complete, allocated_count: 3 }, now);
  assert.equal(result.status, "action_required");
  assert.deepEqual(result.reasons, ["3 bomen toegewezen, 2 besteld"]);
});

test("dubbel Creator-record vereist actie", () => {
  assert.match(determineTreeAllocatedStatus({ ...complete, creator_record_count: 2 }, now).reasons[0], /2 Creator-records/);
});

test("legacy certificate_sent kan de gift-claimstatus niet wijzigen", () => {
  assert.equal(determineTreeAllocatedStatus({ ...complete, certificate_sent: false }, now).status, "completed");
  assert.equal(determineTreeAllocatedStatus({ ...complete, certificate_sent: true, email_submitted: false }, now).status, "action_required");
});

test("niet-gekoppelde Shopify- en Creator-bronnen zijn neutraal niet controleerbaar", () => {
  const result = determineTreeAllocatedStatus({
    ...complete,
    ordered_count: null,
    creator_record_count: null,
    email_submitted: null,
    shopify_source_available: false,
    creator_source_available: false
  }, now);
  assert.equal(result.status, "unverifiable");
  assert.equal(result.label, "Niet volledig controleerbaar");
  assert.notEqual(result.status, "action_required");
  assert.notEqual(result.status, "processing");
});

test("bewezen aantalsverschil blijft actie nodig wanneer andere bronnen ontbreken", () => {
  const result = determineTreeAllocatedStatus({
    ...complete,
    allocated_count: 1,
    shopify_source_available: true,
    creator_source_available: false
  }, now);
  assert.equal(result.status, "action_required");
  assert.deepEqual(result.reasons, ["1 van 2 bomen toegewezen"]);
});

test("bevestigde gift-claim e-mail is vereist voor gemonitorde afronding", () => {
  assert.equal(determineTreeAllocatedStatus({ ...complete, email_submitted: null }, now).status, "processing");
  assert.equal(determineTreeAllocatedStatus({ ...complete, email_submitted: false }, now).status, "action_required");
});

test("geregistreerde technische fout verhindert afronding", () => {
  assert.equal(determineTreeAllocatedStatus({ ...complete, technical_error: "Workflowfout" }, now).status, "action_required");
});

test("Creator-aantal nul is een bewezen afwijking", () => {
  const result = determineTreeAllocatedStatus({ ...complete, creator_record_count: 0, email_submitted: true }, now);
  assert.equal(result.status, "action_required");
});
