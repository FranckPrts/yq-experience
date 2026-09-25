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
    // p5 scenes pasted into YouQuantified, not app code: they define
    // setup/draw/windowResized for p5 to call, which reads as "unused" here.
    "scenes/**",
  ]),
]);

export default eslintConfig;
