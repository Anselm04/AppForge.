## AppForge change review

### Customer-flow impact
- [ ] I checked whether this change affects signup → confirmation → login → entitlement → session persistence → project creation → automatic build → validation → production deployment → verified live product.
- [ ] I did not weaken authentication, Stripe/God Code entitlement, build deduplication, validation, deployment, refund/recovery, or live-product verification.

### Required verification
- [ ] Lint and formatting pass.
- [ ] Typecheck passes.
- [ ] Full test suite passes.
- [ ] Production golden-path/customer-flow contract passes.
- [ ] Security gate passes.
- [ ] Production build passes.
- [ ] No secrets or credentials were committed.
- [ ] Security- or release-critical changes have been reviewed by the code owner.

### Production safety
- [ ] This change is safe to deploy independently.
- [ ] Failure behavior is fail-closed and does not report false success.
- [ ] If this affects deployment or billing, rollback/refund behavior has been considered.
