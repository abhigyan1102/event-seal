import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Base ignores — Deno functions have no Node tsconfig, linted without type info
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.anchor/**",
      "**/coverage/**",
      "scripts/build-functions.mjs",
    ],
  },

  // JS recommended for all files
  js.configs.recommended,

  // Type-aware TypeScript rules for packages + apps (Node tsconfigs exist here)
  {
    files: ["packages/**/*.ts", "apps/**/*.ts", "apps/**/*.tsx"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["packages/sdk/test/*.ts"],
          defaultProject: "packages/sdk/tsconfig.test.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  // Deno functions — TypeScript syntax only, no type-aware rules (Deno runtime, no Node tsconfig)
  {
    files: ["functions/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        Deno: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  // React hooks rules for the web app
  {
    files: ["apps/web/**/*.tsx", "apps/web/**/*.ts"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Node-targeted tooling and test files
  {
    files: [
      "eslint.config.mjs",
      "scripts/**/*.mjs",
      "packages/**/*.test.ts",
      "packages/**/test/**/*.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Web-platform globals used by the universal SDK runtime
  {
    files: ["packages/sdk/src/**/*.ts"],
    languageOptions: {
      globals: {
        atob: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
      },
    },
  },

  // Relax explicit-any in test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
