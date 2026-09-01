#!/usr/bin/env node
/** Evaluate a JS expression from a file in the page context via CDP. */
import fs from "node:fs";

const wsUrl = process.argv[2];
const exprFile = process.argv[3];
const expression = fs.readFileSync(exprFile, "utf8");

const res = await fetch("http://127.0.0.1:9222/json/list");
const targets = await res.json();
const page = targets.find((t) => t.type === "page");
if (!page) { console.error("no page target"); process.exit(1); }

const result = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
    ws.send(
      JSON.stringify({
        id: 2,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id === 2) {
      const r = msg.result?.result ?? {};
      if (r.subtype === "error") reject(new Error(r.description ?? "eval error"));
      else resolve(r.value);
      ws.close();
    }
  };
  ws.onerror = () => reject(new Error("ws error"));
  setTimeout(() => reject(new Error("cdp timeout")), 60000);
});

console.log(result);
