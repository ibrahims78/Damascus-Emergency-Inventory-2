---
name: Branding migration compatibility
description: Product branding moved to Damascus Health Directorate warehouses while legacy mobile and license identifiers remain compatible.
---

The user-facing product identity, seeded warehouse data, destination labels, reports, print output, examples, and active developer documentation use Damascus Health Directorate warehouses. Legacy Android application IDs, license product identifiers, and old stored destination values remain accepted for upgrade and import compatibility.

**Why:** Renaming installed-app or license identifiers would break Android upgrades, existing licenses, or offline data; visible branding can change safely while technical compatibility is preserved.

**How to apply:** Keep new user-created destinations and seeded records on Directorate terminology. Treat old ambulance/referral values as migration/import compatibility only, and do not remove them without an explicit data and release migration plan.