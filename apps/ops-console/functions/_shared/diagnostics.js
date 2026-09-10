// Only fixed labels may leave this module. Never log the original error,
// message, stack, SQL, request, environment, connection URL or certificate.
const codes = new Map([
  ["28P01", "DB_AUTHENTICATION_FAILED"],
  ["28000", "DB_AUTHORIZATION_FAILED"],
  ["42501", "DB_PERMISSION_DENIED"],
  ["3D000", "DB_DATABASE_NOT_FOUND"],
  ["42P01", "DB_RELATION_NOT_FOUND"],
  ["42703", "DB_COLUMN_NOT_FOUND"],
  ["53300", "DB_CONNECTION_LIMIT"],
  ["57014", "DB_QUERY_CANCELLED"],
  ["ENOTFOUND", "DB_DNS_FAILED"],
  ["EAI_AGAIN", "DB_DNS_FAILED"],
  ["ECONNREFUSED", "DB_CONNECTION_REFUSED"],
  ["ECONNRESET", "DB_CONNECTION_RESET"],
  ["ETIMEDOUT", "DB_CONNECTION_TIMEOUT"],
  ["ERR_INVALID_URL", "DB_URL_INVALID"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "DB_TLS_UNTRUSTED"],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", "DB_TLS_UNTRUSTED"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DB_TLS_UNTRUSTED"],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "DB_TLS_UNTRUSTED"],
  ["CERT_HAS_EXPIRED", "DB_TLS_EXPIRED"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "DB_TLS_HOSTNAME_MISMATCH"],
  ["ERR_OSSL_PEM_NO_START_LINE", "DB_CA_INVALID"]
]);
const messages = new Map([
  ["DATABASE_NOT_CONFIGURED", "DB_NOT_CONFIGURED"],
  ["timeout exceeded when trying to connect", "DB_CONNECTION_TIMEOUT"],
  ["Connection terminated due to connection timeout", "DB_CONNECTION_TIMEOUT"]
]);
const endpoints = new Set(["overview", "workflows", "detail", "actions", "events"]);

export function reportFailure(error, endpoint, logger = console.error) {
  try {
    const code = codes.get(error?.code) || messages.get(error?.message) || "UNCLASSIFIED_FAILURE";
    logger(JSON.stringify({
      event: "ops_console_read_failed",
      endpoint: endpoints.has(endpoint) ? endpoint : "unknown",
      code
    }));
  } catch {
    // Diagnostics must never replace the original unavailable response.
  }
}
