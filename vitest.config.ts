import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".opencode", "dist", ".agents"],
    // Coverage gate (ticket 0032). `@vitest/coverage-v8` is the default
    // provider in Vitest 3.x and uses V8's native coverage counters.
    //
    // Threshold strategy (post-mortem de 0032):
    //  - The umbrella 0026 tested pure functions and 2 components. The
    //    remaining surfaces (UI primitives, hooks, route handlers,
    //    types, modality registry, large monolithic clients) are NOT
    //    tested by design — they're either trivial (types) or
    //    framework-bound (Next.js route handlers, shadcn primitives,
    //    GenerateClient/CalculatorClient/SettingsClient which are
    //    candidates for E2E with Playwright). They are excluded from
    //    coverage so the gate measures "what we have committed to
    //    testing" not "everything in src/".
    //  - The remaining threshold catches regressions in the files we
    //    DO test. Raise it in follow-up tickets as more surfaces get
    //    coverage.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // ─── Below: files we are NOT testing by design (0032 baseline) ───
        // Next.js infrastructure: routes, pages, layout.
        "src/app/api/**",
        "src/app/**/page.tsx",
        "src/app/layout.tsx",
        // shadcn UI primitives — wrapper components, not domain logic.
        // Each primitive is exercised indirectly by component tests.
        "src/components/ui/**",
        // Hooks — trivial, exercised indirectly by the components that
        // use them. Direct hook tests can be added later.
        "src/hooks/**",
        // Pure type files and re-exports.
        "src/lib/types.ts",
        "src/**/index.ts",
        // Modality system: registry + view component. Tested indirectly
        // by the components that consume them. A future ticket can add
        // dedicated coverage.
        "src/lib/modalities/**",
        // Settings Zod schema: not part of umbrella 0026. Tested by
        // the /settings page indirectly. Future ticket.
        "src/lib/settings-schema.ts",
        // Calculator schemas.ts — partial coverage from history.ts tests
        // (DiscRowSchema is exercised via the storage tests). The
        // vision-prompt + calculateBreakdownFromImage function are
        // excluded explicitly because they call out to an LLM API.
        "src/lib/calculator/schemas.ts",
        // Large monolithic client components: GenerateClient (60KB),
        // CalculatorClient (40KB), SettingsClient (20KB), and their
        // sub-files. These are candidates for tests E2E con Playwright
        // (out of scope del umbrella 0026) o para un refactor de
        // extracción. Excluidos del coverage hasta que se decida.
        "src/app/generate/**/_components/generate-client.tsx",
        "src/app/settings/**/_components/settings-client.tsx",
        "src/app/tools/weight-calculator/_components/calculator-client.tsx",
        "src/app/tools/weight-calculator/_components/history-page-client.tsx",
        "src/app/tools/weight-calculator/_components/save-record-form.tsx",
        "src/app/tools/weight-calculator/_components/saved-records-panel.tsx",
      ],
      thresholds: {
        // Global threshold (what's left after excludes). Real coverage
        // is 62% lines / 62% statements / 90% functions / 83% branches.
        // We set the threshold a few points below real to leave headroom
        // for small refactors that drop coverage marginally without
        // requiring immediate test additions. Raise in follow-up tickets.
        lines: 60,
        branches: 75,
        functions: 80,
        statements: 60,
        // Per-glob overrides (Vitest 3.x). The key is a micromatch
        // pattern; nested thresholds merge with the global ones. The
        // `src/lib/**` threshold is set close to the real value (83%
        // lines) to catch regressions in pure-function libraries
        // quickly. Raise only when the excluded lib files (e.g.
        // `settings-schema.ts`) get their own test files.
        "src/lib/**": {
          lines: 80,
          branches: 75,
          functions: 90,
          statements: 80,
        },
      },
    },
  },
});
