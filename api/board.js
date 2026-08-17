import { readFile } from "node:fs/promises";
import { get, put } from "@vercel/blob";
import { isAuthenticated } from "./auth.js";

const BOARD_PATH = "mission-board/state.json";

function validState(value) {
  return value && typeof value === "object" && value.campaigns && typeof value.campaigns === "object";
}

async function seedState() {
  return JSON.parse(await readFile(new URL("../public/data/missions.json", import.meta.url), "utf8"));
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    const stored = await get(BOARD_PATH, { access: "private", useCache: false });
    const state = stored ? JSON.parse(await new Response(stored.stream).text()) : await seedState();
    return response.status(200).json(state);
  }

  if (request.method === "PUT") {
    if (!isAuthenticated(request)) return response.status(401).json({ error: "Unauthorized" });
    if (!validState(request.body)) return response.status(400).json({ error: "Invalid board state" });
    const body = JSON.stringify(request.body);
    if (Buffer.byteLength(body) > 4 * 1024 * 1024) return response.status(413).json({ error: "Board state is too large" });
    await put(BOARD_PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json"
    });
    return response.status(200).json({ saved: true });
  }

  response.setHeader("Allow", "GET, PUT");
  return response.status(405).json({ error: "Method not allowed" });
}
