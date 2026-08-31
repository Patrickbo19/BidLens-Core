import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeRfp, extractComplianceMatrix, MAX_TEXT_LENGTH } from "./analysis.js";

const PORT = Number(process.env.PORT || 8080);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BODY_BYTES = MAX_TEXT_LENGTH * 2;

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { status: "ok", service: "bidlens-core", version: "1.0.0" });
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, {
    name: "BidLens Core",
    description: "RFP knockout, fit-score, and compliance-matrix API/MCP service.",
    endpoints: ["POST /v1/analyze", "POST /v1/compliance", "GET /health", "GET /.well-known/mcp-tool.json", "GET /openapi.json"],
  });
  if (req.method === "GET" && ["/.well-known/mcp-tool.json", "/mcp-tool.json"].includes(url.pathname)) {
    return send(res, 200, await readFile(join(root, "mcp-tool.json"), "utf8"));
  }
  if (req.method === "GET" && url.pathname === "/openapi.json") return send(res, 200, await readFile(join(root, "openapi.json"), "utf8"));
  if (req.method === "POST" && url.pathname === "/v1/analyze") return send(res, 200, analyzeRfp(await jsonBody(req)));
  if (req.method === "POST" && url.pathname === "/v1/compliance") return send(res, 200, extractComplianceMatrix(await jsonBody(req)));
  return send(res, 404, { error: "not_found", message: "No route matches this request." });
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    const status = Number(error.status) || (error instanceof RangeError ? 413 : error instanceof TypeError ? 400 : 500);
    send(res, status, { error: status >= 500 ? "internal_error" : "invalid_request", message: error.message });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`BidLens Core listening on ${PORT}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
