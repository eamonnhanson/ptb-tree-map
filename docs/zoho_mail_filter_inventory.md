# Zoho Mail filter inventory

| filter | condition | action | phase_scope |
| --- | --- | --- | --- |
| manual follow-up | subject contains [planteenboom.nu] Bestellen or New Revenue Alert | move to Manual Follow-up | in scope |
| info / outbox monitor | subject contains Record toegevoegd met bcc, Complete your KETSO Academy onboarding, or from info@planteenboom.nu | move to Outbox Monitor | in scope |
| Zapier alerts | subject contains Your Zapier account data is ready to download | move to Zapier Alerts | out of scope |
| payouts | subject contains payout for Plant N Boom is on the way | move to Payouts | out of scope |
