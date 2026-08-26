---
name: API schema codegen exports
description: Durable constraint around Orval-generated Zod exports in this monorepo.
---

Orval's Zod generation can append its generated export lines to the package entrypoint instead of replacing the existing entrypoint. The entrypoint must expose generated TypeScript types and namespace the generated Zod schemas to avoid collisions such as a schema value and a type sharing the same name.

**Why:** Repeated code generation otherwise makes the library fail TypeScript compilation with duplicate exports, even though the generated API files themselves are valid.

**How to apply:** Keep the post-generation normalization step in the API-spec codegen command, and import runtime validators through the `schemas` namespace.