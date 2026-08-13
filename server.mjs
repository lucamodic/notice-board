import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

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
