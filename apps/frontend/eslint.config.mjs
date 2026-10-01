import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // React Compiler rules introduced by eslint-config-next 16. They flag
      // long-standing, intentional idioms in this codebase: react-hook-form's
      // reset-on-close in dialogs and vendored shadcn/ui skeletons/carousels.
      // Keep them visible as warnings and clear them as each file is rewritten
      // in the API-alignment stages rather than churning behaviour now.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;