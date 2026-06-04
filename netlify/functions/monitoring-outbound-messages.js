import pg from "pg";

const { Pool } = pg;
const TEST_DATABASE_NAME = "ptb_monitoring_test";
const MAX_MESSAGES = 50;

let pool;

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const authChallenge = {
  "WWW-Authenticate": 'Basic realm="Plant N Boom automation dashboard", charset="UTF-8"',
  "Cache-Control": "no-store"
};

const monitoringOutboundMessagesQuery = `
  select
    id,
    message_time,
    message_type,
    provider,
    recipient_email,
    subject,
    status,
    related_event_id,
    related_entity_type,
    related_entity_id,
    external_link
  from monitoring.outbound_messages
  order by
    message_time desc,
    created_at desc
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
    const result = await monitoringPool.query(
      monitoringOutboundMessagesQuery,
      [MAX_MESSAGES]
    );

    return json(200, {
      ok: true,
      source: "monitoring",
      database: TEST_DATABASE_NAME,
      messages: result.rows,
      count: result.rows.length,
      generated_at: new Date().toISOString()
    });
  } catch {
    return json(503, {
      ok: false,
      error: "Monitoring database is not reachable"
    });
  }
}
