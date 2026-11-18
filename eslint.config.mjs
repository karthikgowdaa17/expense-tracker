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
    "server/**",
    "server_backup_*/**",
    "server_broken_attempt_*/**",
    // Vendored third-party static assets (e.g. pdfjs worker)
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
