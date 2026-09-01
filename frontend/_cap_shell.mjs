/**
 * Isolated Capacitor build artifact — NOT part of the app source.
 * Renders the built SSR app once and writes dist/client/index.html so the
 * static client bundle can boot inside the Capacitor WebView.
 * Safe to delete; regenerate with: node _cap_shell.mjs
 */
import { writeFileSync } from "node:fs";

const server = (await import("./dist/server/server.js")).default;

async function render(path) {
  const res = await server.fetch(new Request(`http://localhost${path}`));
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    console.log(`[shell] ${path} -> redirect ${res.status} ${loc}`);
    return loc ? render(loc) : { status: res.status, html: await res.text() };
  }
  return { status: res.status, html: await res.text() };
}

const { status, html } = await render("/");
console.log(`[shell] final status=${status} bytes=${html.length}`);
if (status !== 200 || !html.includes("<div")) {
  console.error("[shell] unexpected SSR output — aborting without writing");
  process.exit(1);
}
writeFileSync("./dist/client/index.html", html, "utf8");
console.log("[shell] wrote dist/client/index.html");
const assetRefs = (html.match(/assets\/[A-Za-z0-9._-]+\.(js|css)/g) ?? []).slice(0, 8);
console.log(`[shell] asset refs: ${assetRefs.join(", ")}`);
