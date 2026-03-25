// Add these fields to the BertuiConfig interface in packages/core/src/types/index.ts
// Merge into the existing BertuiConfig — do not replace the whole file, just add the optional block

// ─── Optional feature flags ───────────────────────────────────────────────────
// These are OFF by default. Enabling them requires the matching package to be installed.
//
//   elysia:     true  →  requires bun add @bertui/elysia
//   forms:      true  →  requires bun add @bertui/forms      (coming soon)
//   animations: true  →  requires bun add @bertui/animations  (coming soon)
//   icons:      true  →  requires bun add @bertui/icons        (coming soon)

// Add to BertuiConfig:
//
//   elysia?:     boolean
//   forms?:      boolean
//   animations?: boolean
//   icons?:      boolean
