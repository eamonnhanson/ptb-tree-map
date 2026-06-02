const REALM = "Plant N Boom automation dashboard";

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store"
    }
  });
}

function unavailable() {
  return new Response("Automation dashboard protection is not configured", {
    status: 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function getCredentials(request) {
  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice("Basic ".length));
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

export default async (request, context) => {
  const expectedUser = Deno.env.get("AUTOMATION_DASHBOARD_USER");
  const expectedPassword = Deno.env.get("AUTOMATION_DASHBOARD_PASSWORD");

  if (!expectedUser || !expectedPassword) {
    return unavailable();
  }

  const credentials = getCredentials(request);

  if (
    !credentials ||
    credentials.user !== expectedUser ||
    credentials.password !== expectedPassword
  ) {
    return unauthorized();
  }

  const url = new URL(request.url);

  if (url.pathname === "/automation-dashboard") {
    url.pathname = "/automation-dashboard/";

    return Response.redirect(url, 308);
  }

  return context.next();
};
