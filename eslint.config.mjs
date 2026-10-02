import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // `Image` in these files is @react-pdf/renderer's PDF primitive, not an
    // HTML <img>. It has no `alt` prop, so the a11y rule cannot apply; the
    // accessible invoice is the HTML one in components/print/.
    files: ["components/pdf/**/*.tsx"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
  { ignores: [".next/**", "node_modules/**", "tests/e2e/**", "references/**"] },
];
