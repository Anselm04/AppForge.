# Build-flow verification — 11 October 2026

The interrupted-build screen previously asked for approvals even when the saved plan and all required decisions were approved. It now offers one saved-build retry without claiming outstanding approvals. Unapproved decisions retain the approval panel and disabled retry. Server-side execution and approval checks remain authoritative.

A rendered-page regression reproduced the duplicate approval panel before the change. Afterward, the approved retry reports a runtime failure without bypassing the server, and an unapproved plan still blocks retry. The four affected recovery, execution-readiness and customer-flow/golden-path suites passed 37 checks. The integrated main baseline passed 204 test files, 1,295 tests and one skip; the new rendered checks add two tests.

Live verification confirmed an authenticated saved-build retry returns the secure-runtime-unavailable error before generation. A working README revision saves with an explicit full-validation requirement. This is not successful generated-product validation, preview, deployment or product-use evidence. The existing-host controller remains qualified only for controlled fixtures and disabled for customer execution. No Sprites, paid upgrades, new runtime resource or token creation was used.

AppForge is not approved for paying customers. A complete customer build requires an integrated qualified runner, verified independent preview/hosting and successful product behavior. Existing account, email, billing and recovery launch requirements remain subject to their separate verification.
