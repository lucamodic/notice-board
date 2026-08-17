import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";

try {
  const env = await readFile(new URL("./.env", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {}

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (pathname === "/api/auth") {
    return handleAuth(req, res);
  }
  if (pathname === "/api/board") {
    return handleBoard(req, res);
  }
  const requested = pathname.startsWith("/Graphic Elements") || pathname.startsWith("/data/") || pathname === "/wood-wall.jpg"
    ? join(root, "public", normalize(pathname))
    : join(root, pathname === "/" || pathname === "/admin" || pathname === "/missions" ? "index.html" : normalize(pathname));
  try {
    const info = await stat(requested);
    const file = info.isDirectory() ? join(requested, "index.html") : requested;
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
}).listen(port, () => console.log(`Mission Board listo en http://localhost:${port}/missions`));

async function handleAuth(req, res) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const send = (status, body, cookie) => {
    const headers = { "Content-Type": "application/json; charset=utf-8" };
    if (cookie) headers["Set-Cookie"] = cookie;
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  };
  if (!username || !password) return send(500, { error: "Admin credentials are not configured" });
  const token = createHmac("sha256", password).update(`mission-board:${username}`).digest("hex");
  const supplied = (req.headers.cookie || "").match(/(?:^|;\s*)mission_board_admin=([^;]+)/)?.[1] || "";
  const actual = Buffer.from(decodeURIComponent(supplied));
  const expected = Buffer.from(token);
  const authenticated = actual.length === expected.length && timingSafeEqual(actual, expected);

  if (req.method === "GET") return send(authenticated ? 200 : 401, { authenticated });
  if (req.method === "DELETE") return send(200, { authenticated: false }, "mission_board_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  if (req.method !== "POST") return send(405, { error: "Method not allowed" });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body = {};
  try { body = JSON.parse(raw); } catch {}
  if (body.username !== username || body.password !== password) return send(401, { error: "Invalid credentials" });
  send(200, { authenticated: true }, `mission_board_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`);
}

async function handleBoard(req, res) {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const runtimeDir = join(root, ".runtime");
  const runtimeFile = join(runtimeDir, "board.json");

  if (req.method === "GET") {
    try {
      return send(200, JSON.parse(await readFile(runtimeFile, "utf8")));
    } catch {
      return send(200, JSON.parse(await readFile(join(root, "public", "data", "missions.json"), "utf8")));
    }
  }

  if (req.method !== "PUT") return send(405, { error: "Method not allowed" });
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  const token = createHmac("sha256", password).update(`mission-board:${username}`).digest("hex");
  const supplied = decodeURIComponent((req.headers.cookie || "").match(/(?:^|;\s*)mission_board_admin=([^;]+)/)?.[1] || "");
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(token);
  if (!username || !password || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error: "Unauthorized" });

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 4 * 1024 * 1024) return send(413, { error: "Board state is too large" });
  }
  let state;
  try { state = JSON.parse(raw); } catch { return send(400, { error: "Invalid JSON" }); }
  if (!state?.campaigns || typeof state.campaigns !== "object") return send(400, { error: "Invalid board state" });
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(runtimeFile, JSON.stringify(state, null, 2), "utf8");
  send(200, { saved: true });
}
