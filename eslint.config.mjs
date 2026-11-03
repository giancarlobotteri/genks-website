import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "chatbot-import-reference/**", "chatbot2-import-reference/**", "chatbot3-import-reference/**"]),
]);
