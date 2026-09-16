const unauthorized = () => new Response("Authentication required", {
  status: 401,
  headers: {
    "WWW-Authenticate": 'Basic realm="KETSO Operations Console", charset="UTF-8"',
    "Cache-Control": "no-store"
  }
});

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export default async (request: Request, context: any) => {
  const user = Deno.env.get("OPS_CONSOLE_USER") || "";
  const password = Deno.env.get("OPS_CONSOLE_PASSWORD") || "";
  if (!user || !password) {
    return new Response("Operations Console protection is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return unauthorized();
    const suppliedUser = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (!safeEqual(suppliedUser, user) || !safeEqual(suppliedPassword, password)) {
      return unauthorized();
    }
  } catch {
    return unauthorized();
  }

  return context.next();
};
