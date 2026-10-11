# Build-flow verification — 11 October 2026

An interrupted saved build with all decisions approved previously displayed duplicate approval and retry controls. The recovery screen now offers one retry with accurate guidance. Unapproved decisions retain the approval panel and disabled retry. Server approval and execution checks remain authoritative.

An unvalidated working revision previously opened a blocked preview iframe. The build page now explains that full validation is required, while preserving runtime previews for validated and production-certified artifacts. Saving remains distinct from validating and publishing.

Native Node ESM execution also exposed older extensionless imports that the previous hardening pass had damaged. The recovery pass uses JavaScript syntax trees to repair import/export and literal dynamic-import paths only when exactly one existing JavaScript target resolves. It preserves comments, string examples, explicit extensions, missing/ambiguous targets, CommonJS and frontend TypeScript. It respects the nearest package module type and never invents modules or replaces backend behavior.

Rendered recovery and preview regressions failed before repair. A real native Node fixture failed with ERR_MODULE_NOT_FOUND, then started successfully after recovery, exercising side-effect imports, directory reexports and dynamic imports. The seven affected suites passed 74 checks. Existing controlled isolation tests passed all 16 cases. Full exact-head CI, security and production build must pass before merge.

Live edit/save/reload confirmed the exact saved README revision survives refresh. A saved-build retry returned secure-runtime-unavailable before generation; preview confirmed a blocked iframe for the unvalidated revision. These are not successful generated-product validation, deployment or product-use evidence. The existing-host controller remains qualified only for controlled fixtures and disabled for customer execution. No Sprites, paid upgrades, new runtime resource or token creation was used.

AppForge is not approved for paying customers. A complete customer build requires an integrated qualified runner, verified independent preview/hosting and successful product behavior. Existing account, email, billing and recovery launch requirements remain subject to their separate verification.
