const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../../../artifacts/web/dist/public");
const destination = path.resolve(__dirname, "../app/web");

if (!fs.existsSync(path.join(source, "index.html"))) {
  throw new Error(`Built web application not found at ${source}`);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true });

console.log(`Copied web build to ${destination}`);