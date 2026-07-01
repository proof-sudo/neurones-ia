import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next ne livre que des configs au format eslintrc (objets `extends`),
// pas des tableaux flat-config. On les consomme via FlatCompat (approche officielle
// Next 15 + ESLint 9, générée par create-next-app).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Fichiers non lintés : build Next, types générés, et scripts Node CommonJS
    // (.cjs — `require()` y est légitime, pas du code applicatif).
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "**/*.cjs"],
  },
  {
    rules: {
      // App francophone : les apostrophes/guillemets bruts en JSX sont parfaitement
      // rendus par le navigateur. Échapper chaque « ' » en « &apos; » nuit à la
      // lisibilité sans bénéfice réel → règle désactivée.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
