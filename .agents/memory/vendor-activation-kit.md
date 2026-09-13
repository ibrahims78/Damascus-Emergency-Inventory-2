---
name: Vendor activation kit
description: Boundary between public activation material and the confidential vendor signing bundle.
---

The public activation kit must contain only generators, public verification keys,
key identifiers, and test licenses. The working vendor kit is a separate,
confidential bundle with one matching `license-private-key.pem` beside each
platform generator.

**Why:** The generators fail with “Signing key not found” when the private key
is intentionally absent from the public kit. Shipping the private key in the
public repository or GitHub release would allow unauthorized license issuance.

**How to apply:** When a vendor needs a working generator, create a local
vendor-only bundle, verify each private key matches its platform public key,
run disposable generation tests, and present that bundle directly without
committing or uploading it to public release assets.