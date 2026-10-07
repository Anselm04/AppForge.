# AppForge launch bar

This is the only production-readiness bar for AppForge. Everything outside it waits.

1. Account lifecycle works for real: signup, email confirmation, login, logout, login again, session persistence/recovery.
2. Money works for real: checkout, entitlement creation, renewal/cancellation/failure handling, duplicate/delayed webhook safety, and no payment crossover with other products.
3. Builds work for real: create a project, agents build it, source persists, preview works, edits work, validation reruns, and deployment succeeds.
4. Interrupted builds recover: disconnect/worker restart/queue retry returns the customer to the correct project state without loss or duplication.
5. Generated paid/authenticated SaaS is safe: auth lifecycle, tenant isolation, and billing lifecycle evidence are required before production certification.
6. Security boundaries are enforced: secrets stay server-side, customer/project ownership is checked, tools/providers fail closed, and admin MFA works.
7. Production infrastructure survives normal failure: PostgreSQL, Redis, two-machine coordination, backups, restore, and deployment recovery.
8. Monitoring and evidence exist: errors and critical events are observable and the exact artifact declared ready is the artifact actually tested/deployed.
9. The full real customer journey passes repeatedly, not once.
10. No false green state: AppForge must never say done or production-certified when a required gate is missing.

## Acceptance authority

Automated checks may prove implementation and machine-verifiable evidence, but they do not replace the owner's physical acceptance testing of real provider interactions. Manual production workflows must fail closed when their required real-world inputs/evidence are missing.
