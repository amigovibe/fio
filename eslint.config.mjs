import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Block-explorer / RPC responses are untyped external JSON; `any` is used
      // deliberately at those boundaries. Surface as a warning, not a build error.
      "@typescript-eslint/no-explicit-any": "warn",
      // localStorage and theme hydration legitimately set state from an effect
      // on mount (SSR-safe pattern). Keep as a warning rather than an error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
