#!/usr/bin/env node
/**
 * CDP driver for the protected Electron build.
 * Usage:
 *   node cdp-gate.mjs read                    -> deviceId + environment diagnostics
 *   node cdp-gate.mjs activate <licenseFile>  -> paste license, click activate, read result
 */
import fs from "node:fs";

const DEBUG_PORT = 9222;
const action = process.argv[2];
const licenseFile = process.argv[3];

async function getTargets() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  return targets.filter((t) => t.type === "page");
}

function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: ++id, method: "Runtime.enable" }));
      ws.send(
        JSON.stringify({
          id: ++id,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && msg.id > 1) {
        const r = msg.result?.result ?? {};
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else if (r.subtype === "error") reject(new Error(r.description ?? "evaluation error"));
        else resolve(r.value);
        ws.close();
      }
    };
    ws.onerror = () => reject(new Error("websocket error"));
    setTimeout(() => reject(new Error("cdp timeout")), 45000);
  });
}

const targets = await getTargets();
if (targets.length === 0) {
  console.error("NO PAGE TARGETS - is the app running with --remote-debugging-port=9222?");
  process.exit(1);
}
const page = targets[0];
console.log("target:", page.title ?? page.url);

if (action === "readta") { const r = await evaluate(page.webSocketDebuggerUrl, '(async () => {
  const ta = document.getElementById("protected-license");
  const val = ta ? ta.value : "(no textarea)";
  return JSON.stringify({ length: val.length, first40: val.slice(0, 40), last40: val.slice(-40), hasNewline: val.includes("\n"), hasSpace: val.includes(" "), dotCount: (val.match(/\./g) || []).length });
})()'); console.log(r); } else if (action === "read") {
  const diag = await evaluate(
    page.webSocketDebuggerUrl,
    `(async () => {
      const out = {};
      out.userAgent = navigator.userAgent;
      out.hasSubtle = !!(window.crypto && window.crypto.subtle);
      try {
        await window.crypto.subtle.importKey("raw", new Uint8Array(32), "Ed25519", false, ["verify"]);
        out.webcryptoEd25519 = "supported";
      } catch (e) { out.webcryptoEd25519 = "NOT supported: " + e.name; }
      try {
        const h = new Uint8Array(await window.crypto.subtle.digest("SHA-512", new TextEncoder().encode("abc")));
        out.sha512 = "len=" + h.length;
      } catch (e) { out.sha512 = "NO: " + e.name; }
      const code = document.querySelector("code");
      out.deviceId = code ? code.textContent : "(not found)";
      const footer = [...document.querySelectorAll("p")].map((p) => p.textContent).find((t) => t && t.includes("Gate"));
      out.gateMarker = footer ?? "(no marker)";
      return JSON.stringify(out);
    })()`,
  );
  console.log(JSON.parse(diag));
} else if (action === "activate") {
  const license = fs.readFileSync(licenseFile, "utf8").trim();
  const result = await evaluate(
    page.webSocketDebuggerUrl,
    `(async () => {
      const lic = ${JSON.stringify(license)};
      const ta = document.getElementById("protected-license");
      if (!ta) return "no textarea (gate not visible?)";
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, lic);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      const allButtons = [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
      const activateBtn = [...document.querySelectorAll("button")].find((b) => {
        const t = (b.textContent || "").trim();
        return t.includes("تفعيل") || t.includes("تنشيط") || t.includes("Activate");
      });
      if (!activateBtn) return "no activate button. buttons=" + JSON.stringify(allButtons);
      activateBtn.click();
      await new Promise((r) => setTimeout(r, 4000));
      const resultEl = document.querySelector(".text-red-300, .text-emerald-300, .text-green-300");
      const bodyHasGate = !!document.getElementById("protected-license");
      return JSON.stringify({
        clicked: (activateBtn.textContent || "").trim(),
        result: resultEl ? resultEl.textContent : "(no result message)",
        gateStillVisible: bodyHasGate,
      });
    })()`,
  );
  console.log(JSON.parse(result));
} else {
  console.error("usage: node cdp-gate.mjs read | activate <licenseFile>");
  process.exit(1);
}
