/**
 * Serve the static export in `out/` the way a plain static host would.
 *
 * `next start` cannot serve an `output: "export"` build, so this is the local
 * equivalent of the IPFS/object-store deployment: no rewrites, no server
 * rendering, only files that exist. Run `npm run build` first.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve as resolvePath, sep } from "node:path";

const ROOT = resolvePath(process.cwd(), "out");
const PORT = Number(process.env.PORT ?? 3000);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/vnd.microsoft.icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function insideRoot(candidate: string): boolean {
  const relative = candidate.slice(ROOT.length);
  return candidate === ROOT || relative.startsWith(sep);
}

async function findFile(urlPath: string): Promise<string | null> {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const base = normalize(clean).replace(/^([/\\])+/, "");
  const candidates = [
    join(ROOT, base),
    join(ROOT, base, "index.html"),
    `${join(ROOT, base)}.html`,
  ];
  for (const candidate of candidates) {
    if (!insideRoot(candidate)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (request, response) => {
  const file = await findFile(request.url ?? "/");
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found. Run `npm run build` first.\n");
    return;
  }
  const body = await readFile(file);
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  response.end(body);
}).listen(PORT, () => {
  console.log(`Serving out/ on http://localhost:${PORT}`);
});
