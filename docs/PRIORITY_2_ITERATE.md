# Priority 2 — Iterate without breaking green

**Goal:** Chat / Senior Dev can change a generated app and the tree stays runnable (Bolt/Lovable parity on the edit loop).

## Path

1. User message → Quick Edit (default) or Senior Dev (plan + multi-step)
2. Propose patches
3. Apply → `hardenAfterIterate` (deps allowlist, entrypoints, file cap, no compliance on golden)
4. Sandbox validate
5. Deterministic error fixes → surgical LLM fix (≤2)
6. Still red → **rollback to baseline** (never leave a broken project)

## Key modules

- `src/lib/iterateReliable.ts` — patch apply, harden, ensureIterateGreen, context select
- `src/services/quickEditAgent.ts` — chat path
- `src/agents/seniorDevAgent.ts` — planned multi-step path + rollback
- `src/routers/projectChat.ts` — API + metadata (`rolledBack`, `fixed`)

## Done when

- Edit that compiles → saved + preview invalidated
- Edit that breaks → fixed or rolled back; project still green
- No compliance sprawl on React golden trees after iterate
