# Independent application architecture

The repository is intended to retain one source-control boundary while moving toward three independently deployable applications.

| Application | Current/future role | Deployment boundary |
|---|---|---|
| Tree Map | Public map platform, currently with a Plant N Boom branded deployment at `map.planteenboom.nu` | Existing production deployment, unchanged |
| Uploader, later KETSO Field | Staff, student and future farmer field workflows, potentially at `field.ketso.nl` | Existing deployment remains unchanged; isolation is future work |
| Operations Console | Internal monitoring, reviews and later carefully authorized operational actions, intended for `ops.ketso.nl` | New `apps/ops-console` Netlify site |

The Operations Console has its own package manifest, frontend, functions, tests, environment-variable namespace, Netlify configuration and build output. It deliberately duplicates small infrastructure patterns instead of moving shared production code.

No root routing or deployment setting is changed. Creating the new Netlify site requires explicitly selecting `apps/ops-console` as its base directory. This lets Ops Console changes deploy without rebuilding the existing applications and lets existing application changes be ignored by the Ops Console site.

PostgreSQL may remain shared initially, but the deployment identity must not be shared. The console should use a dedicated SELECT-only role. Registry records describe configuration and implementation; review rows describe verification; automation events and outbound messages provide runtime/historical evidence. The application never collapses those sources into an unsupported claim of health.

Future KETSO product direction can remain:

```text
KETSO
  Tree Map platform
    Plant N Boom branded deployment
  KETSO Field
    staff, students and farmers
  Operations Console
    monitoring, reviews and future actions
```

This note records the direction only. It does not migrate the Tree Map or uploader.
