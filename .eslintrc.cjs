/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended"],
  ignorePatterns: ["dist", "node_modules", "coverage"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-undef": "off",
  },
};
