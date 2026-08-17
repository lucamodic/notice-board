import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mission_board_admin";

function sessionToken(username, password) {
  return createHmac("sha256", password).update(`mission-board:${username}`).digest("hex");
}

function cookieValue(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function isAuthenticated(request, username = process.env.ADMIN_USERNAME, password = process.env.ADMIN_PASSWORD) {
  if (!username || !password) return false;
  const actual = Buffer.from(cookieValue(request));
  const expected = Buffer.from(sessionToken(username, password));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function setCookie(response, value, maxAge) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Secure`
  );
}

export default function handler(request, response) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    return response.status(500).json({ error: "Admin credentials are not configured" });
  }

  if (request.method === "GET") {
    const authenticated = isAuthenticated(request, username, password);
    return response.status(authenticated ? 200 : 401).json({ authenticated });
  }

  if (request.method === "POST") {
    const valid = request.body?.username === username && request.body?.password === password;
    if (!valid) return response.status(401).json({ error: "Invalid credentials" });
    setCookie(response, sessionToken(username, password), 60 * 60 * 12);
    return response.status(200).json({ authenticated: true });
  }

  if (request.method === "DELETE") {
    setCookie(response, "", 0);
    return response.status(200).json({ authenticated: false });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed" });
}
