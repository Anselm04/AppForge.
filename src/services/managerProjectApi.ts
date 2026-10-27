import type { Request, Response } from "express";
export type ManagerUser = {
  id: number;
  email: string;
  name?: string;
  isBanned?: boolean;
};
export async function callManagerProjectApi(
  user: ManagerUser,
  action: string,
  input: any,
  context: { req: Request; res: Response },
): Promise<any> {
  const { projectsRouter } = await import("../routers/projects.js");
  const caller = projectsRouter.createCaller({
    ...context,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || "TrillionAI Manager",
    },
  });
  switch (action) {
    case "executionReadiness": {
      const { assertBuildExecutionReady } =
        await import("./buildExecutionReadiness.js");
      try {
        await assertBuildExecutionReady();
        return {
          executionEligible: true,
          verification: "preflight_only",
          perBuildVerificationRequired: true,
        };
      } catch {
        return {
          executionEligible: false,
          reason: "build_runtime_unavailable",
          perBuildVerificationRequired: true,
        };
      }
    }
    case "getFiles":
      return caller.getFiles(input);
    case "download":
      return caller.download(input);
    case "snapshots":
      return caller.snapshots(input);
    case "getLogs":
      return caller.getLogs(input);
    case "list":
      return caller.list();
    case "get":
      return caller.get(input);
    case "create":
      return caller.create(input);
    case "evidence":
      return caller.evidence(input);
    case "artifact": {
      await caller.get({ id: input.id });
      const { getCurrentArtifact } = await import("../db.js");
      const a = await getCurrentArtifact(input.id);
      return a
        ? {
            snapshotId: a.snapshotId,
            version: a.version,
            sha256: a.integrity.sha256,
          }
        : null;
    }
    case "approvePlan":
      return caller.approvePlan(input);
    case "revisePlan":
      return caller.revisePlan(input);
    case "resumeApprovedBuild":
      return caller.resumeApprovedBuild(input);
    case "seniorDev":
      return caller.seniorDev(input);
    case "seniorDevApprove": {
      const task = await caller.seniorDevTask(input);
      if (task.status !== "awaiting_approval") {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "CONFLICT",
          message: "Repair task is not awaiting approval",
        });
      }
      // Approval is durably queued with the command. The worker performs the atomic resume transition.
      return { taskId: input.taskId, status: "queued_for_resume" };
    }
    case "seniorDevTask":
      return caller.seniorDevTask(input);
    case "recoverInterruptedBuild":
      return caller.recoverInterruptedBuild(input);
    case "recoveryStatus":
      return caller.recoveryStatus(input);
    case "deploy":
      return caller.deploy(input);
    case "deployOptions":
      return caller.deployOptions(input);
    case "requiredEnvVars":
      return caller.requiredEnvVars(input);
    case "revenueReadiness":
      return caller.revenueReadiness(input);
    default:
      throw Error("manager_operation_not_allowed");
  }
}
