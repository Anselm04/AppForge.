import { STACK_ADAPTERS } from "../lib/stackAdapters.js";
import { BUILD_CAPABILITIES } from "../lib/buildCapabilities.js";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isOwnerEmail } from "../lib/owner.js";
import { PRODUCT_TYPES } from "../lib/productContract.js";
import {
  commandHash,
  managerBuildTitle,
  getManagerCommandLedger,
  type ManagerCommandLedger,
  type ManagerCommandRecord,
} from "../services/managerCommands.js";
import {
  callManagerProjectApi,
  type ManagerUser,
} from "../services/managerProjectApi.js";
type Settings = Record<string, string | undefined>;
export type ManagerRouterDependencies = {
  env: Settings;
  getUser: (id: number) => Promise<ManagerUser | undefined>;
  call: typeof callManagerProjectApi;
  ledger: ManagerCommandLedger;
};
const id = z.number().int().positive();
const actionSchemas = {
  build: z
    .object({
      title: z.string().min(1).max(255),
      description: z.string().min(5).max(12000),
      productType: z.enum(PRODUCT_TYPES).optional(),
      techStack: z.string().min(1).max(80).optional(),
      locale: z.string().max(10).optional(),
    })
    .strict(),
  approve_plan: z.object({ projectId: id }).strict(),
  revise_plan: z
    .object({ projectId: id, revision: z.string().min(5).max(5000) })
    .strict(),
  resume_build: z.object({ projectId: id }).strict(),
  repair: z
    .object({
      projectId: id,
      request: z.string().min(5).max(5000),
      mode: z.enum(["collaborative", "autonomous"]).default("autonomous"),
    })
    .strict(),
  approve_repair: z.object({ taskId: id }).strict(),
  recover_build: z.object({ projectId: id }).strict(),
  deploy: z
    .object({
      id,
      destination: z
        .enum(["preview", "vercel", "netlify", "fly", "github-pages"])
        .default("preview"),
    })
    .strict(),
};
type Action = keyof typeof actionSchemas;
const actions = Object.keys(actionSchemas) as [Action, ...Action[]];
const commandSchema = z
  .object({
    requestId: z.string().regex(/^[-a-zA-Z0-9_]{1,100}$/),
    action: z.enum(actions),
    input: z.record(z.string(), z.unknown()),
  })
  .strict();
const procedures: Record<Action, string> = {
  build: "create",
  approve_plan: "approvePlan",
  revise_plan: "revisePlan",
  resume_build: "resumeApprovedBuild",
  repair: "seniorDev",
  approve_repair: "seniorDevApprove",
  recover_build: "recoverInterruptedBuild",
  deploy: "deploy",
};
const scopes: Record<Action, string> = {
  build: "build",
  approve_plan: "plan",
  revise_plan: "plan",
  resume_build: "build",
  repair: "repair",
  approve_repair: "repair",
  recover_build: "recover",
  deploy: "preview",
};
function error(code: string, status: number) {
  return Object.assign(new Error(code), { status, managerCode: code });
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function set(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
}
function limit(env: Settings) {
  const n = Number(env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT);
  return Number.isSafeInteger(n) && n > 0 && n <= 1000 ? n : 0;
}
function operationFailure(e: unknown) {
  const code = (e as any)?.code;
  return typeof code === "string" &&
    [
      "BAD_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "TOO_MANY_REQUESTS",
      "SERVICE_UNAVAILABLE",
    ].includes(code)
    ? `appforge_${code.toLowerCase()}`
    : "manager_operation_failed";
}
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
export function createManagerRouter(
  options: Partial<ManagerRouterDependencies> = {},
) {
  const router = Router();
  const env = options.env || process.env;
  const call = options.call || callManagerProjectApi;
  const getUser =
    options.getUser ||
    (async (id: number) => {
      const { getUserById } = await import("../db.js");
      const user = await getUserById(id);
      if (!user) return undefined;
      const { getAccountLifecycleState } =
        await import("../services/accountLifecycleService.js");
      const { accountLifecycleAllowsAccess } =
        await import("../middleware/accountLifecycleAccess.js");
      if (!accountLifecycleAllowsAccess(await getAccountLifecycleState(id)))
        return undefined;
      return user;
    });
  const ledger = () => options.ledger || getManagerCommandLedger();
  router.use((req, res, next) => {
    void (async () => {
      res.setHeader("cache-control", "no-store");
      if (!env.APPFORGE_MANAGER_TOKEN || env.APPFORGE_MANAGER_TOKEN.length < 32)
        throw error("manager_not_configured", 503);
      if (
        !equal(
          req.get("authorization") || "",
          `Bearer ${env.APPFORGE_MANAGER_TOKEN}`,
        )
      )
        throw error("manager_unauthorized", 401);
      if (req.get("origin")) throw error("manager_server_to_server_only", 403);
      const userId = Number(env.APPFORGE_MANAGER_USER_ID);
      if (!Number.isSafeInteger(userId) || userId <= 0)
        throw error("manager_identity_not_configured", 503);
      const user = await getUser(userId);
      if (
        !user ||
        user.id !== userId ||
        user.isBanned ||
        !isOwnerEmail(user.email)
      )
        throw error("manager_company_identity_required", 403);
      res.locals ??= {};
      res.locals.managerUser = user;
    })().then(() => next(), next);
  });
  const user = (res: Response) => res.locals.managerUser as ManagerUser;
  function requireScope(scope: string) {
    if (!set(env.APPFORGE_MANAGER_SCOPES || "read").has(scope))
      throw error("manager_scope_required", 403);
  }
  async function invoke(
    req: Request,
    res: Response,
    action: string,
    input: unknown,
  ) {
    return call(user(res), action, input, { req, res });
  }
  function publicRecord(row: ManagerCommandRecord) {
    return {
      requestId: row.requestId,
      action: row.action,
      status: row.status,
      result: row.result,
      error: row.error,
      createdAt: row.createdAt,
      execution: row.execution,
    };
  }
  async function commission(req: Request, res: Response, body: unknown) {
    const parsed = commandSchema.parse(body);
    const input = actionSchemas[parsed.action].parse(parsed.input) as Record<
      string,
      unknown
    >;
    let scope = scopes[parsed.action];
    if (parsed.action === "deploy" && input.destination !== "preview") {
      scope = "deploy";
      if (
        !set(env.APPFORGE_MANAGER_DEPLOY_DESTINATIONS).has(
          String(input.destination),
        )
      )
        throw error("manager_deployment_destination_not_allowed", 403);
    }
    requireScope(scope);
    const dailyLimit = limit(env);
    if (!dailyLimit) throw error("manager_execution_limit_required", 503);
    const reserved = await ledger().reserve(
      user(res).id,
      {
        requestId: parsed.requestId,
        action: parsed.action,
        input,
        inputHash: commandHash(parsed.action, input),
      },
      dailyLimit,
    );
    if (!reserved.fresh)
      return {
        status:
          reserved.record.status === "executing"
            ? 202
            : reserved.record.status === "failed"
              ? 409
              : 200,
        body: publicRecord(reserved.record),
      };
    try {
      const prepared =
        parsed.action === "build"
          ? {
              ...input,
              title: managerBuildTitle(parsed.requestId, String(input.title)),
            }
          : input;
      const result = await invoke(
        req,
        res,
        procedures[parsed.action],
        prepared,
      );
      await ledger().complete(user(res).id, parsed.requestId, result);
      return {
        status: 202,
        body: {
          requestId: parsed.requestId,
          action: parsed.action,
          status: "completed",
          result,
        },
      };
    } catch (e) {
      const code = operationFailure(e);
      // A transport/provider failure can follow a successful external effect. Preserve the command for reconciliation.
      await ledger()
        .fail(
          user(res).id,
          parsed.requestId,
          code,
          code === "manager_operation_failed",
        )
        .catch(() => undefined);
      throw e;
    }
  }
  router.get(
    "/capabilities",
    asyncRoute(async (_req, res) => {
      requireScope("read");
      return res.json({
        system: "appforge",
        productTypes: PRODUCT_TYPES,
        buildCapabilities: Object.values(BUILD_CAPABILITIES).map(
          ({ id, label, suggestedStack }) => ({ id, label, suggestedStack }),
        ),
        stacks: STACK_ADAPTERS.map(
          ({
            id,
            productTypes,
            generationMode,
            runtime,
            artifactKind,
            deploymentTargets,
          }) => ({
            id,
            productTypes,
            generationMode,
            runtime,
            artifactKind,
            deploymentTargets,
          }),
        ),
        scopes: [...set(env.APPFORGE_MANAGER_SCOPES || "read")],
        dailyActionLimit: limit(env),
        deploymentDestinations: [
          "preview",
          ...set(env.APPFORGE_MANAGER_DEPLOY_DESTINATIONS),
        ],
        prohibited: [
          "delete",
          "account_changes",
          "billing_policy_changes",
          "secrets",
          "shell",
          "monetization_approval",
          "integration_approval",
        ],
      });
    }),
  );
  router.get(
    "/execution-readiness",
    asyncRoute(async (req, res) => {
      requireScope("read");
      return res.json(await invoke(req, res, "executionReadiness", undefined));
    }),
  );
  router.get(
    "/projects",
    asyncRoute(async (req, res) => {
      requireScope("read");
      return res.json(await invoke(req, res, "list", undefined));
    }),
  );
  for (const [suffix, procedure] of [
    ["", "get"],
    ["/evidence", "evidence"],
    ["/files", "getFiles"],
    ["/download", "download"],
    ["/snapshots", "snapshots"],
    ["/logs", "getLogs"],
    ["/recovery", "recoveryStatus"],
    ["/deploy-options", "deployOptions"],
    ["/required-env", "requiredEnvVars"],
    ["/revenue-readiness", "revenueReadiness"],
  ] as const) {
    router.get(
      `/projects/:id${suffix}`,
      asyncRoute(async (req, res) => {
        requireScope("read");
        const projectId = id.parse(Number(req.params.id));
        return res.json(
          await invoke(
            req,
            res,
            procedure,
            ["recoveryStatus", "snapshots", "getLogs"].includes(procedure)
              ? { projectId }
              : { id: projectId },
          ),
        );
      }),
    );
  }
  router.get(
    "/repairs/:id",
    asyncRoute(async (req, res) => {
      requireScope("read");
      return res.json(
        await invoke(req, res, "seniorDevTask", {
          taskId: id.parse(Number(req.params.id)),
        }),
      );
    }),
  );
  router.post(
    "/commands",
    asyncRoute(async (req, res) => {
      const r = await commission(req, res, req.body);
      return res.status(r.status).json(r.body);
    }),
  );
  router.get(
    "/commands/:requestId",
    asyncRoute(async (req, res) => {
      requireScope("read");
      const row = await ledger().get(
        user(res).id,
        String(req.params.requestId),
      );
      if (!row) throw error("manager_command_not_found", 404);
      return res.json(publicRecord(row));
    }),
  );
  router.post(
    "/jobs",
    asyncRoute(async (req, res) => {
      const body = req.body;
      if (
        !body ||
        !["improve", "educate"].includes(body.action) ||
        typeof body.taskId !== "string" ||
        typeof body.payload?.description !== "string"
      )
        throw error("manager_job_input_required", 400);
      const r = await commission(req, res, {
        requestId: body.taskId,
        action: "build",
        input: {
          title: body.payload.title || "TrillionAI product",
          description: body.payload.description,
          ...(body.payload.techStack
            ? { techStack: body.payload.techStack }
            : {}),
          ...(body.payload.productType
            ? { productType: body.payload.productType }
            : {}),
        },
      });
      return res.status(r.status).json({ taskId: body.taskId, ...r.body });
    }),
  );
  router.get(
    "/jobs/:taskId",
    asyncRoute(async (req, res) => {
      requireScope("read");
      const taskId = String(req.params.taskId);
      let row = await ledger().get(user(res).id, taskId);
      if (!row) throw error("manager_command_not_found", 404);
      // Read-only reconciliation of a lost build response. A missing project never authorizes another build.
      if (row.status === "executing" && row.action === "build" && row.input) {
        const title = managerBuildTitle(taskId, String(row.input.title));
        const projects = await invoke(req, res, "list", undefined);
        const match = projects.find((p: any) => p.title === title);
        if (match) {
          await ledger().complete(user(res).id, taskId, {
            id: match.id,
            reconciled: true,
          });
          row = { ...row, status: "completed", result: { id: match.id } };
        }
      }
      if (row.status === "failed")
        return res.json({ taskId, status: "failed", error: row.error });
      if (
        row.status === "completed" &&
        row.result?.status === "clarification_required"
      )
        return res.json({
          taskId,
          status: "pending",
          reason: "product_clarification_required",
          clarification: row.result.clarification,
        });
      if (
        row.status !== "completed" ||
        row.action !== "build" ||
        !Number.isSafeInteger(row.result?.id)
      )
        return res.json({ taskId, status: "running" });
      const project = await invoke(req, res, "get", { id: row.result.id });
      if (["failed", "error"].includes(project.status))
        return res.json({ taskId, status: "failed", projectId: row.result.id });
      if (!["validated", "production-certified"].includes(project.status))
        return res.json({
          taskId,
          status: project.status === "paused" ? "pending" : "running",
          projectId: row.result.id,
          pauseReason: project.pauseReason || null,
        });
      const artifact = await invoke(req, res, "artifact", {
        id: row.result.id,
      });
      if (
        !artifact ||
        !Number.isSafeInteger(artifact.version) ||
        artifact.version <= 0 ||
        !/^[a-f0-9]{64}$/.test(artifact.sha256 || "")
      )
        return res.json({
          taskId,
          status: "pending",
          reason: "verified_current_artifact_required",
        });
      const base = new URL(env.PUBLIC_APP_URL || env.APP_URL || "");
      if (base.protocol !== "https:")
        throw error("manager_public_origin_required", 503);
      return res.json({
        taskId,
        status: "verified",
        projectId: row.result.id,
        deliverableKind: "source_artifact",
        productionReady: false,
        artifact,
        evidenceUrl: `${base.origin}/integrations/manager/projects/${row.result.id}/evidence`,
      });
    }),
  );
  router.use((e: any, _req: Request, res: Response, _next: NextFunction) => {
    const known =
      e?.managerCode ||
      (["manager_idempotency_conflict", "manager_daily_limit_reached"].includes(
        e?.message,
      )
        ? e.message
        : null);
    const status =
      e instanceof z.ZodError
        ? 400
        : known === "manager_daily_limit_reached"
          ? 429
          : known === "manager_idempotency_conflict"
            ? 409
            : known
              ? e.status || 503
              : (
                  {
                    BAD_REQUEST: 400,
                    UNAUTHORIZED: 401,
                    FORBIDDEN: 403,
                    NOT_FOUND: 404,
                    CONFLICT: 409,
                    TOO_MANY_REQUESTS: 429,
                    SERVICE_UNAVAILABLE: 503,
                  } as Record<string, number>
                )[e?.code] || 503;
    res.status(status).json({
      error:
        e instanceof z.ZodError
          ? "invalid_manager_command"
          : known || operationFailure(e),
    });
  });
  return router;
}
export const managerIntegrationRouter = createManagerRouter();
