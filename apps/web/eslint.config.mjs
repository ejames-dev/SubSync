import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      // New in eslint-plugin-react-hooks v7 (pulled in by the Next 16 bump).
      // Flag pre-existing patterns (setState-in-effect, missing error
      // boundaries); downgraded to avoid a behavioral React refactor inside
      // a dependency-security PR.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
    },
  },
];

export default eslintConfig;
