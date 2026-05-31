# Zoho mail monitoring requirements

Goal:
Use selected Zoho Mail folders as source signals for the internal Plant N Boom / KETSO monitoring dashboard.

Relevant folders:

1. Manual Follow-up
2. Outbox Monitor
3. Zapier Alerts
4. Payouts

Current situation:
Zoho Mail is being used as a rough audit and notification layer. This has become hard to monitor manually. The dashboard should help detect:

* incoming purchases that need manual follow-up
* outbound customer emails that prove a workflow happened
* Zapier alerts or failures
* payout notifications
* missing follow-up after purchases
* workflow events that currently only exist as emails

Relevant filters visible in Zoho Mail:

1. payouts

   * condition: subject contains "payout for Plant N Boom is on the way"
   * action: move to folder Payouts

2. Zapier alerts

   * condition: subject contains "Your Zapier account data is ready to download"
   * action: move to folder Zapier Alerts

3. manual follow-up

   * condition: subject contains "[planteenboom.nu] Bestellen" or "New Revenue Alert"
   * action: move to folder Manual Follow-up

4. info / outbox monitor

   * conditions include:

     * subject contains "Record toegevoegd met bcc"
     * subject contains "Complete your KETSO Academy onboarding"
     * from contains "[info@planteenboom.nu](mailto:info@planteenboom.nu)"
   * action: move to folder Outbox Monitor

Dashboard meaning:

* Manual Follow-up = orange by default, because human action may be required.
* Outbox Monitor = evidence archive, usually green if it proves an outbound action happened.
* Zapier Alerts = warning or error source, orange or red depending on subject/body.
* Payouts = finance signal, usually informational unless payout failed or requires action.

Important:
The dashboard should not treat all email as equal.
It must classify emails into operational event types:

* purchase_received
* manual_followup_required
* outbound_email_sent
* tree_allocated_email_seen
* onboarding_email_sent
* subscription_thank_you_sent
* zapier_alert
* zapier_error
* payout_received
* payout_problem
* unknown_email_signal

The dashboard should not send or delete emails.
The dashboard should read and classify.
Manual actions can be added later.
