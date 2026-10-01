# AppForge AI Agents (Phase 4)

AppForge uses a set of focused AI agents to turn natural-language prompts into a coherent build plan before code is generated and refined visually.

## Roles

- **Architect Agent** — understands the idea and proposes the overall system architecture.
- **Backend Agent** — designs the API surface, service layer, and backend flows.
- **Frontend Agent** — maps user journeys to React pages, components, and routes.
- **Database Agent** — proposes PostgreSQL/Drizzle schema, relationships, and indexing.
- **DevOps Agent** — defines CI/CD, Docker, monitoring, and backup strategy.
- **Security Agent** — reviews authentication, validation, rate limiting, and security headers.
- **Testing Agent** — defines testing strategy and Vitest test skeletons.

## Types

The core types live in `src/agents/types.ts`:

- `AgentRole` — union of all agent roles.
- `AgentContext` — shared context passed between agents.
- `AgentTask` and `AgentResult` — metadata and outputs for each agent.
- `BuildPlan` — aggregated build plan for the entire app.

## Planning helper

`src/services/agent-orchestrator.ts` is a standalone build-planning helper. It is
not wired to the production build endpoint. The production build path uses the
guarded `projects.create` procedure, the build queue, and the authenticated SSE
route described below.

The helper runs its planning agents in sequence:

```ts
const orchestrator = new AgentOrchestrator();
const plan = await orchestrator.runBuild(prompt);
```

The orchestrator:

1. Creates an `AgentContext` from the incoming prompt.
2. Runs each agent and collects `AgentResult` objects.
3. Stores key decisions (architecture, schema, endpoints, etc.) in `context.decisions`.
4. Returns a `BuildPlan` that summarizes the app.

## Production build route

`src/routes/agents.ts` retains the legacy endpoint only to reject it clearly:

- `POST /api/agents/build` returns HTTP 410 and directs callers to the current build flow.

The production flow is:

1. Call authenticated tRPC `projects.create`; it validates intake, CAPTCHA, moderation, tier and credits, then claims and enqueues the build.
2. Connect to authenticated `GET /api/build/:projectId` for build events.

## Lifecycle: From Prompt to App

1. **Prompt** — the user describes their app idea.
2. **Project creation** — `projects.create` validates the request, creates the project, and starts the production build queue.
3. **AI build** — the production agent pipeline researches, plans, generates, validates, and reports evidence through the build event stream.
4. **Templates** — Phase 2 templates can seed the plan with proven structures.
5. **Visual Builder** — Phase 3 lets the user refine layout, content, and styling.
6. **Deployment** — Phase 5 (deployment automation) will turn the plan into a live app.

## Extending agents

To add a new agent:

1. Implement `Agent` in `src/agents/<name>Agent.ts`.
2. Add the agent to the `agents` array in `agent-orchestrator.ts`.
3. Optionally expose role-specific routes or UI.

## Safety

Agents produce _plans_, not runtime code. Code generation still passes through the safety measures you've already implemented: input validation, rate limiting, security headers, and testing.

Use monitoring from Phase 2/3/5 to track agent performance, errors, and user experience.
