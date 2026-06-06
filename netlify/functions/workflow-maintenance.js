import pg from "pg";

const { Pool } = pg;
const TEST_DATABASE_NAME = "ptb_monitoring_test";
const MAX_WORKFLOWS = 200;
const MAX_CONNECTIONS = 200;
const MAX_CODE_ASSETS = 300;
const MAX_RUNBOOKS = 100;
const MAX_REVIEWS = 100;
const MAX_DEPENDENCIES = 300;

let pool;

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const authChallenge = {
  "WWW-Authenticate": 'Basic realm="Plant N Boom automation dashboard", charset="UTF-8"',
  "Cache-Control": "no-store"
};

const databaseCheckQuery = "select current_database() as database";

const countsQuery = `
  select
    (select count(*)::int from monitoring.workflow_registry) as workflow_registry,
    (select count(*)::int from monitoring.workflow_connections) as workflow_connections,
    (select count(*)::int from monitoring.workflow_code_assets) as workflow_code_assets,
    (select count(*)::int from monitoring.workflow_runbooks) as workflow_runbooks,
    (select count(*)::int from monitoring.workflow_reviews) as workflow_reviews,
    (select count(*)::int from monitoring.workflow_dependencies) as workflow_dependencies
`;

const workflowsQuery = `
  select
    workflow_id,
    workflow_name,
    platform,
    source_system,
    target_system,
    status,
    risk_level,
    owner_name,
    business_purpose,
    last_tested_at,
    next_review_at,
    notes
  from monitoring.workflow_registry
  order by platform, workflow_id
  limit $1
`;

const connectionsQuery = `
  select
    system,
    connection_name,
    username,
    role_name,
    rights_summary,
    used_by,
    secret_location,
    review_status,
    least_privilege_status
  from monitoring.workflow_connections
  order by system, connection_name
  limit $1
`;

const codeAssetsQuery = `
  select
    file_path,
    asset_type,
    purpose,
    related_workflows,
    environment_variables,
    status,
    review_status
  from monitoring.workflow_code_assets
  order by file_path
  limit $1
`;

const runbooksQuery = `
  select
    workflow_id,
    runbook_file,
    runbook_title,
    runbook_type,
    status,
    purpose,
    safe_test_steps
  from monitoring.workflow_runbooks
  order by workflow_id nulls last, runbook_file
  limit $1
`;

const reviewsQuery = `
  select
    workflow_id,
    review_type,
    review_status,
    findings,
    action_items,
    next_review_at
  from monitoring.workflow_reviews
  order by created_at desc
  limit $1
`;

const dependenciesQuery = `
  select
    workflow_id,
    dependency_order,
    dependency_type,
    source_system,
    target_system,
    trigger_or_input,
    action_summary,
    output_summary,
    uncertainty_level,
    missing_information
  from monitoring.workflow_dependencies
  order by workflow_id, dependency_order nulls last
  limit $1
`;

function json(statusCode, body) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

function getHeader(headers, name) {
  const match = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );

  return match?.[1] || "";
}

function getCredentials(headers) {
  const header = getHeader(headers, "authorization");

  if (!header.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(
      header.slice("Basic ".length),
      "base64"
    ).toString("utf8");
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return null;
    }

    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function requireBasicAuth(event) {
  const expectedUser = process.env.AUTOMATION_DASHBOARD_USER;
  const expectedPassword = process.env.AUTOMATION_DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return json(503, {
      ok: false,
      error: "Monitoring API protection is not configured"
    });
  }

  const credentials = getCredentials(event.headers);

  if (
    !credentials ||
    credentials.user !== expectedUser ||
    credentials.password !== expectedPassword
  ) {
    return {
      statusCode: 401,
      headers: authChallenge,
      body: "Authentication required"
    };
  }

  return null;
}

function getMonitoringDatabaseUrl() {
  const connectionString = process.env.MONITORING_DATABASE_URL;

  if (!connectionString) {
    return {
      ok: false,
      error: "Monitoring database is not configured"
    };
  }

  try {
    const parsed = new URL(connectionString);
    const database = parsed.pathname.slice(1);

    if (database !== TEST_DATABASE_NAME) {
      return {
        ok: false,
        error: "Monitoring database is not configured for the test database"
      };
    }

    return {
      ok: true,
      connectionString,
      ssl:
        parsed.searchParams.get("sslmode") === "disable"
          ? false
          : { rejectUnauthorized: false }
    };
  } catch {
    return {
      ok: false,
      error: "Monitoring database configuration is invalid"
    };
  }
}

function getPool(connectionString, ssl) {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });
  }

  return pool;
}

export async function handler(event) {
  const authError = requireBasicAuth(event);

  if (authError) {
    return authError;
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        ...jsonHeaders,
        Allow: "GET"
      },
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed"
      })
    };
  }

  const databaseConfig = getMonitoringDatabaseUrl();

  if (!databaseConfig.ok) {
    return json(503, {
      ok: false,
      error: databaseConfig.error
    });
  }

  try {
    const monitoringPool = getPool(
      databaseConfig.connectionString,
      databaseConfig.ssl
    );

    const databaseResult = await monitoringPool.query(databaseCheckQuery);
    const database = databaseResult.rows[0]?.database;

    if (database !== TEST_DATABASE_NAME) {
      return json(503, {
        ok: false,
        error: "Monitoring database is not configured for the test database"
      });
    }

    const [
      countsResult,
      workflowsResult,
      connectionsResult,
      codeAssetsResult,
      runbooksResult,
      reviewsResult,
      dependenciesResult
    ] = await Promise.all([
      monitoringPool.query(countsQuery),
      monitoringPool.query(workflowsQuery, [MAX_WORKFLOWS]),
      monitoringPool.query(connectionsQuery, [MAX_CONNECTIONS]),
      monitoringPool.query(codeAssetsQuery, [MAX_CODE_ASSETS]),
      monitoringPool.query(runbooksQuery, [MAX_RUNBOOKS]),
      monitoringPool.query(reviewsQuery, [MAX_REVIEWS]),
      monitoringPool.query(dependenciesQuery, [MAX_DEPENDENCIES])
    ]);

    return json(200, {
      ok: true,
      source: "workflow_maintenance",
      database,
      generated_at: new Date().toISOString(),
      counts: countsResult.rows[0] || {
        workflow_registry: 0,
        workflow_connections: 0,
        workflow_code_assets: 0,
        workflow_runbooks: 0,
        workflow_reviews: 0,
        workflow_dependencies: 0
      },
      workflows: workflowsResult.rows,
      connections: connectionsResult.rows,
      code_assets: codeAssetsResult.rows,
      runbooks: runbooksResult.rows,
      reviews: reviewsResult.rows,
      dependencies: dependenciesResult.rows
    });
  } catch {
    return json(503, {
      ok: false,
      error: "Workflow maintenance database is not reachable"
    });
  }
}
