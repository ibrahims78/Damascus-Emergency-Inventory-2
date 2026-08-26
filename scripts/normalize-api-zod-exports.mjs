import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(process.cwd(), "../api-zod/src/index.ts");

await writeFile(
  indexPath,
  'export type * from "./generated/types";\nexport * as schemas from "./generated/api";\n',
  "utf8",
);