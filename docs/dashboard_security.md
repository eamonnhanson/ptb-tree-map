# Automation dashboard security

The automation dashboard is intended for internal monitoring and must not be publicly accessible without protection.

## MVP protection

`/automation-dashboard/` is protected by a Netlify Edge Function using HTTP Basic Auth. The function is configured in `netlify.toml` and applies to:

- `/automation-dashboard`
- `/automation-dashboard/`
- `/automation-dashboard/*`

This protects the HTML page and static assets such as `app.js`, `styles.css`, and `student-uploads.json`.

The slashless route `/automation-dashboard` redirects to `/automation-dashboard/` so relative asset paths resolve correctly.

## Netlify settings

Set these environment variables in Netlify for the relevant deploy context:

- `AUTOMATION_DASHBOARD_USER`
- `AUTOMATION_DASHBOARD_PASSWORD`

Do not commit credentials to the repository.

If either variable is missing, the protected dashboard route returns `503` instead of serving the dashboard.

## Local test

Use Netlify CLI:

```bash
netlify dev
```

Expected checks:

- `/automation-dashboard/` without credentials returns `401`.
- `/automation-dashboard/` with the configured credentials loads the dashboard.
- `/automation-dashboard` with the configured credentials redirects to `/automation-dashboard/`.
- `/automation-dashboard/app.js` is also protected.
- `/` and `/forest` remain public.

## Staging test

After setting the environment variables in the staging or deploy-preview context:

- Open `/automation-dashboard/` and confirm the browser asks for credentials.
- Confirm the correct credentials load the dashboard.
- Confirm an incorrect password returns `401`.
- Confirm the public tree map still loads without credentials.
