# AppForge no-spend HTTP capacity baseline

This controlled test exercises only read-only health endpoints on the local AppForge Node server. It cannot launch a customer build, make AI calls, submit payments, use Fly.io, deploy projects, or test an external host.

## Run against a manually started local AppForge server

```bash
npm run test:local-load-contract
LOAD_REQUESTS=200 LOAD_CONCURRENCY=10 npm run load:local-http
LOAD_TARGET=http://127.0.0.1:3000/api/health/ready LOAD_REQUESTS=1000 LOAD_CONCURRENCY=25 npm run load:local-http
```

The script rejects remote hosts, non-health paths, credentials, query strings, and redirects; the maximum is 10,000 requests and 128 concurrent consumers per invocation. It reports status codes, failures, timeouts, throughput and latency percentiles. A non-200 response causes failure, including a real 503 from readiness checks.

Passing this smoke test is **not** evidence of one million active customers, build capacity, database scaling, AI provider quotas, tenant isolation, or payment reliability. The wider acceptance load suite still needs authenticated sign-in and project journeys, isolated worker crash recovery, billing idempotency, database query budgets, queue fairness, and realistic duration-based traffic.

Never publish a capacity number from code inspection or fabricated results. Store the raw command, environment, commit SHA, timestamp, request counts and observed failures alongside every capacity claim.
