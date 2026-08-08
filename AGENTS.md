# Codex repository instructions

## Repository context

- This repository is `ptb-tree-map`.
- `main` must not be used for implementation work.
- Use a dedicated feature, fix, or chore branch for changes.
- Do not assume the historical staging workflow in `PROJECT_STATUS.md` is still current. Verify deployment practice before relying on it.

## Git in the Windows Codex sandbox

- Git may report dubious ownership because Codex runs under a sandbox identity.
- When required, use:

  ```powershell
  git -c safe.directory=C:/GitHub/ptb-tree-map ...
  ```

- Do not change global Git `safe.directory` configuration.
- GitHub CLI authentication is available in the host PowerShell environment but may not be available inside the Codex sandbox.
- Do not attempt to repair GitHub authentication by requesting, exposing, copying, or storing GitHub tokens.
- Do not push, merge, or create remote pull requests unless explicitly requested and authentication is available through an approved mechanism.

## Before editing

- Inspect the relevant implementation before changing it.
- Preserve existing architecture and conventions unless the task specifically requires a change.
- Keep changes limited to the requested scope.
- Check Git status before starting.
- Do not modify unrelated files.

## Tests

- The standard test command is:

  ```powershell
  npm test
  ```

- Run relevant tests after code changes.
- For broad or cross-cutting changes, run the full `npm test` suite.
- Do not weaken, remove, or skip existing tests merely to make a change pass.
- Report any test that cannot be run.

## Production and external systems

- Treat Render, Netlify, Aiven, PostgreSQL, Shopify, Chargebee, Zoho, Zapier, OpenAI APIs, email systems, and other connected external systems as production-sensitive unless explicitly established otherwise.
- Investigation should be read-only by default.
- Do not deploy, redeploy, change configuration, change environment variables, invoke webhooks, send messages, or mutate external data without explicit approval.
- Do not infer permission to change an external system merely because credentials or tools are available.

## PostgreSQL and SQL

- Treat production PostgreSQL data as critical.
- Do not execute data-changing SQL against production without explicit approval.
- Never run `DELETE`, `DROP`, `TRUNCATE`, destructive `ALTER` statements, bulk `UPDATE` operations, or destructive migration scripts without explicit approval.
- Do not run `scripts/backfillTutorQuestion353.js` unless the user explicitly requests that operation and the target database has been identified.
- Inspect SQL files before executing them.
- Prefer version-controlled SQL or migrations for schema changes.
- Verify the target environment before any database-changing operation.
- Do not assume that SQL files under `docs/sql` are safe to run automatically.

## Secrets and environment files

- Never display, copy, commit, log, or expose secret values.
- Do not read or print values from `.env` unless a specific task genuinely requires a particular setting and the user explicitly authorizes it.
- Never commit `.env` or other credential files.
- If an `.env.example` is later created, it must contain variable names and safe placeholders only.
- Do not expose database URLs, passwords, API keys, tokens, webhook secrets, dashboard credentials, or private certificates.

## Sensitive repository content

- Treat `docs/sources/` as potentially sensitive because it may contain customer data, operational exports, emails, screenshots, Zapier exports, or business information.
- Do not broadly inspect, summarize, copy, or modify `docs/sources/` unless it is relevant to the requested task.
- Avoid exposing personal or operational data in responses.

## Netlify

- `netlify.toml` is source-controlled configuration.
- `.netlify/` is local/generated state and must not be edited or committed.
- Do not perform production Netlify deployments unless explicitly requested.

## Render

- Render configuration currently appears to live outside this repository.
- Do not assume or recreate Render settings without first inspecting the actual Render configuration.
- Do not trigger production deployments unless explicitly requested.

## Certificates and TLS

- `certs/ca.pem` is tracked and used by deployed code.
- Preserve it unless the task specifically concerns certificate rotation or TLS configuration.
- Changes to TLS verification or database certificate handling require explicit review because the repository currently contains inconsistent TLS approaches.

## Working style

For investigation requests:

1. Inspect.
2. Trace the relevant flow.
3. Identify the root cause or current behavior.
4. Report findings and risks.
5. Do not implement unless implementation was requested.

For implementation requests:

1. Confirm branch and working tree.
2. Inspect relevant code.
3. Make the smallest safe change.
4. Run relevant tests.
5. Review the Git diff.
6. Report changed files and test results.
7. Do not deploy or merge unless explicitly requested.

For potentially destructive or production-changing requests:

- Stop before the destructive action.
- State exactly what would change.
- Identify the target environment.
- Request explicit approval.
