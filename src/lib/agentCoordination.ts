import { z } from "zod";
import type { ProductContract } from "./productContract.js";
import type { ProductPlan, ProductPlanTask } from "./productPlan.js";
import type { ResearchRecord } from "./researchRecord.js";

const nonEmpty = z.string().trim().min(1);

export const coordinationEventSchema = z.object({
  at: nonEmpty,
  agent: nonEmpty,
  type: z.enum([
    "input",
    "start",
    "decision",
    "handoff",
    "output",
    "retry",
    "pause",
    "resume",
    "failure",
    "complete",
  ]),
  taskId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  detail: z.string(),
});

export type CoordinationEvent = z.infer<typeof coordinationEventSchema>;

export const taskCoordinationStateSchema = z.object({
  taskId: nonEmpty,
  ownerAgent: nonEmpty,
  requirementIds: z.array(nonEmpty),
  dependencies: z.array(nonEmpty),
  ownedFiles: z.array(nonEmpty),
  validations: z.array(nonEmpty),
  status: z.enum([
    "pending",
    "blocked",
    "running",
    "retrying",
    "paused",
    "failed",
    "completed",
  ]),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  outputFiles: z.array(nonEmpty),
});

export type TaskCoordinationState = z.infer<
  typeof taskCoordinationStateSchema
>;

export const agentCoordinationRecordSchema = z.object({
  version: z.literal(1),
  projectId: z.number().int().positive(),
  productType: nonEmpty,
  selectedTechnologyStack: nonEmpty,
  planTitle: nonEmpty,
  requirementIds: z.array(nonEmpty),
  researchDecisionIds: z.array(nonEmpty),
  taskStates: z.record(z.string(), taskCoordinationStateSchema),
  fileOwners: z.record(z.string(), nonEmpty),
  events: z.array(coordinationEventSchema),
  updatedAt: nonEmpty,
});

export type AgentCoordinationRecord = z.infer<
  typeof agentCoordinationRecordSchema
>;

export type AgentCoordinationContext = {
  productContract: ProductContract;
  productPlan: ProductPlan;
  researchDecisions: ResearchRecord["decisions"];
  requirementIds: string[];
};

export function createAgentCoordinationContext(input: {
  productContract: ProductContract;
  productPlan: ProductPlan;
  researchRecord?: ResearchRecord | null;
}): AgentCoordinationContext {
  const requirementIds = input.productContract.functionalRequirements.map(
    (requirement) => requirement.id,
  );
  const planRequirementIds = new Set(
    input.productPlan.tasks.flatMap((task) => task.requirementIds),
  );

  for (const requirement of input.productContract.functionalRequirements) {
    if (
      requirement.priority === "must" &&
      !planRequirementIds.has(requirement.id)
    ) {
      throw new Error(
        `Agent coordination rejected plan that dropped must-have requirement ${requirement.id}`,
      );
    }
  }

  const researchDecisions = input.researchRecord?.decisions ?? [];
  const availableDecisionIds = new Set(
    researchDecisions.map((decision) => decision.id),
  );
  for (const decisionId of input.productPlan.researchDecisionIds) {
    if (!availableDecisionIds.has(decisionId)) {
      throw new Error(
        `Planner references unavailable research decision ${decisionId}`,
      );
    }
  }

  return {
    productContract: input.productContract,
    productPlan: input.productPlan,
    researchDecisions,
    requirementIds,
  };
}

export function createAgentCoordinationRecord(input: {
  projectId: number;
  context: AgentCoordinationContext;
}): AgentCoordinationRecord {
  const fileOwners: Record<string, string> = {};
  const taskStates: Record<string, TaskCoordinationState> = {};

  for (const task of input.context.productPlan.tasks) {
    for (const file of task.files) {
      const existing = fileOwners[file];
      if (existing && existing !== task.id) {
        throw new Error(
          `Duplicate file ownership: ${file} is assigned to both ${existing} and ${task.id}`,
        );
      }
      fileOwners[file] = task.id;
    }

    taskStates[task.id] = {
      taskId: task.id,
      ownerAgent: task.agent,
      requirementIds: [...task.requirementIds],
      dependencies: [...task.dependencies],
      ownedFiles: [...task.files],
      validations: [...task.validations],
      status: task.dependencies.length > 0 ? "blocked" : "pending",
      attempts: 0,
      lastError: null,
      outputFiles: [],
    };
  }

  return agentCoordinationRecordSchema.parse({
    version: 1,
    projectId: input.projectId,
    productType: input.context.productContract.productType,
    selectedTechnologyStack:
      input.context.productContract.selectedTechnologyStack,
    planTitle: input.context.productPlan.title,
    requirementIds: input.context.requirementIds,
    researchDecisionIds:
      input.context.productPlan.researchDecisionIds,
    taskStates,
    fileOwners,
    events: [],
    updatedAt: new Date().toISOString(),
  });
}

export function validateTaskHandoff(input: {
  context: AgentCoordinationContext;
  record: AgentCoordinationRecord;
  task: ProductPlanTask;
  completedTaskIds: Set<string>;
}): void {
  const { task } = input;
  const planTask = input.context.productPlan.tasks.find(
    (candidate) => candidate.id === task.id,
  );
  if (!planTask) {
    throw new Error(`Unknown coordination task ${task.id}`);
  }

  for (const dependency of task.dependencies) {
    if (!input.completedTaskIds.has(dependency)) {
      throw new Error(
        `Task ${task.id} cannot start before dependency ${dependency} completes`,
      );
    }
  }

  for (const requirementId of task.requirementIds) {
    if (!input.context.requirementIds.includes(requirementId)) {
      throw new Error(
        `Task ${task.id} references requirement outside canonical contract: ${requirementId}`,
      );
    }
  }

  for (const file of task.files) {
    if (input.record.fileOwners[file] !== task.id) {
      throw new Error(
        `Task ${task.id} does not own planned file ${file}`,
      );
    }
  }

  if (input.context.productPlan.taskToAgent[task.id] !== task.agent) {
    throw new Error(
      `Task ${task.id} agent ownership disagrees with validated plan`,
    );
  }
}

export function assertTaskOutputOwnership(input: {
  task: ProductPlanTask;
  files: Record<string, string>;
  record: AgentCoordinationRecord;
}): void {
  const allowed = new Set(input.task.files);
  const produced = Object.keys(input.files);

  if (produced.length === 0) {
    throw new Error(`Task ${input.task.id} returned no generated files`);
  }

  for (const file of produced) {
    if (!allowed.has(file)) {
      throw new Error(
        `Task ${input.task.id} attempted to write unowned file ${file}`,
      );
    }
    if (input.record.fileOwners[file] !== input.task.id) {
      throw new Error(
        `Task ${input.task.id} attempted to overwrite file owned by ${input.record.fileOwners[file] ?? "another task"}`,
      );
    }
  }
}

export function appendCoordinationEvent(
  record: AgentCoordinationRecord,
  event: Omit<CoordinationEvent, "at"> & { at?: string },
): AgentCoordinationRecord {
  return agentCoordinationRecordSchema.parse({
    ...record,
    events: [
      ...record.events,
      coordinationEventSchema.parse({
        ...event,
        at: event.at ?? new Date().toISOString(),
      }),
    ].slice(-500),
    updatedAt: new Date().toISOString(),
  });
}

export function updateTaskCoordinationState(
  record: AgentCoordinationRecord,
  taskId: string,
  patch: Partial<Omit<TaskCoordinationState, "taskId">>,
): AgentCoordinationRecord {
  const current = record.taskStates[taskId];
  if (!current) throw new Error(`Unknown coordination task ${taskId}`);

  return agentCoordinationRecordSchema.parse({
    ...record,
    taskStates: {
      ...record.taskStates,
      [taskId]: {
        ...current,
        ...patch,
        taskId,
      },
    },
    updatedAt: new Date().toISOString(),
  });
}

export function unlockReadyTasks(
  record: AgentCoordinationRecord,
): AgentCoordinationRecord {
  const completed = new Set(
    Object.values(record.taskStates)
      .filter((task) => task.status === "completed")
      .map((task) => task.taskId),
  );
  const taskStates = { ...record.taskStates };

  for (const [taskId, task] of Object.entries(taskStates)) {
    if (
      task.status === "blocked" &&
      task.dependencies.every((dependency) => completed.has(dependency))
    ) {
      taskStates[taskId] = { ...task, status: "pending" };
    }
  }

  return agentCoordinationRecordSchema.parse({
    ...record,
    taskStates,
    updatedAt: new Date().toISOString(),
  });
}


export function buildAgentTaskContext(input: {
  context: AgentCoordinationContext;
  task: ProductPlanTask;
}): string {
  const requirementSet = new Set(input.task.requirementIds);
  const requirements = input.context.productContract.functionalRequirements.filter(
    (requirement) => requirementSet.has(requirement.id),
  );
  const decisionSet = new Set(input.context.productPlan.researchDecisionIds);
  const researchDecisions = input.context.researchDecisions.filter((decision) =>
    decisionSet.has(decision.id),
  );

  return JSON.stringify(
    {
      productContract: input.context.productContract,
      productPlan: {
        title: input.context.productPlan.title,
        overview: input.context.productPlan.overview,
        architecture: input.context.productPlan.architecture,
        implementationSequence:
          input.context.productPlan.implementationSequence,
      },
      task: input.task,
      requirements,
      researchDecisions,
      coordinationRules: {
        scopeImmutable: true,
        ownedFilesOnly: true,
        dependenciesMustBeComplete: true,
        requirementsMayNotBeDropped: true,
        researchCannotChangePermissions: true,
      },
    },
    null,
    2,
  );
}

export function reconcileCoordinationResume(input: {
  record: AgentCoordinationRecord;
  generatedFiles: Record<string, string>;
}): AgentCoordinationRecord {
  let record = input.record;

  for (const [taskId, state] of Object.entries(record.taskStates)) {
    if (state.status !== "completed") continue;

    const missing = state.outputFiles.filter(
      (file) => !(file in input.generatedFiles),
    );
    if (state.outputFiles.length === 0 || missing.length > 0) {
      record = updateTaskCoordinationState(record, taskId, {
        status: state.dependencies.length > 0 ? "blocked" : "pending",
        lastError:
          state.outputFiles.length === 0
            ? "Completed task had no persisted output files during resume"
            : `Resume detected missing output files: ${missing.join(", ")}`,
        outputFiles: [],
      });
    }
  }

  return unlockReadyTasks(record);
}

export function coordinationStatusSummary(
  record: AgentCoordinationRecord,
): {
  pending: number;
  blocked: number;
  running: number;
  retrying: number;
  paused: number;
  failed: number;
  completed: number;
} {
  const summary = {
    pending: 0,
    blocked: 0,
    running: 0,
    retrying: 0,
    paused: 0,
    failed: 0,
    completed: 0,
  };
  for (const state of Object.values(record.taskStates)) {
    summary[state.status] += 1;
  }
  return summary;
}
