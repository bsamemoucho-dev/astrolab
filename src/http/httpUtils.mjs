import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, sep } from "node:path";

const MAX_JSON_BODY_BYTES = 64 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

export function setSessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `astrolab_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `astrolab_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function securityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-opener-policy": "same-origin"
  };
}

export async function readJson(req) {
  const contentType = req.headers["content-type"] ?? "";
  if (contentType && !String(contentType).toLowerCase().startsWith("application/json")) {
    const error = new Error("Expected application/json request body");
    error.status = 415;
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

export async function sendStatic(publicDir, req, res) {
  const url = new URL(req.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedPath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalizedPath);
  const publicRelativePath = relative(publicDir, filePath);

  if (publicRelativePath.startsWith("..") || publicRelativePath.includes(`..${sep}`)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      ...securityHeaders(),
      "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream"
    });
    res.end(content);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    const fallback = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, { ...securityHeaders(), "content-type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}
