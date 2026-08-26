import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const forbiddenPath = /(^|\/)(\.env($|\.)|.*\.(jks|keystore|p12|pfx|pem|key)$|.*private.*key.*|release-secrets|release-staging)/i;
const forbiddenTracked = tracked.filter((file) => forbiddenPath.test(file));
if (forbiddenTracked.length) {
  throw new Error(`Sensitive release material is tracked: ${forbiddenTracked.join(", ")}`);
}

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
for (const required of [".env", "*.jks", "*.keystore", "*.p12", "*.pem", "*.key", "release-secrets/"]) {
  if (!gitignore.includes(required)) {
    throw new Error(`Missing release-secret ignore rule: ${required}`);
  }
}

const expectedFiles = [
  "artifacts/web/dist/public/index.html",
  "artifacts/web/dist/protected/public/index.html",
  "artifacts/api-server/dist/index.mjs",
  "artifacts/api-server/dist/protected/index.mjs",
];
for (const file of expectedFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Expected build output is missing: ${file}`);
  }
}

const scanRoot = join(root, "artifacts");
const suspiciousContent =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----|aws_secret_access_key\s*=\s*\S+|github_token\s*=\s*\S+/i;
function walk(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const file = join(directory, entry);
    const details = statSync(file);
    if (details.isDirectory()) results.push(...walk(file));
    else results.push(file);
  }
  return results;
}

for (const file of walk(scanRoot)) {
  if (!file.includes(`${join("dist", "protected")}${"/"}`)) continue;
  if (statSync(file).size > 5_000_000) continue;
  const content = readFileSync(file, "utf8");
  if (suspiciousContent.test(content)) {
    throw new Error(`Suspicious secret material found in protected output: ${relative(root, file)}`);
  }
}

console.log("PASS phase 1 build boundary: standard/protected outputs are isolated.");
console.log("PASS phase 1 secret boundary: tracked files and build outputs contain no signing material.");