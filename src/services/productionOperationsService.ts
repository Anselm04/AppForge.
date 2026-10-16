import { sql } from "drizzle-orm";
import { db, getProjectById } from "../db.js";
import {
  createChangeContract,
  validateChangeContract,
  type ChangeContract,
} from "../lib/changeContract.js";
import {
  createSupportCase,
  type SupportSeverity,
} from "../lib/customerOperations.js";

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function requireOwnedProject(userId: number, projectId: number) {
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId)
    throw new Error("Project not found");
  return project;
}

export async function persistChangeContract(input: {
  userId: number;
  projectId: number;
  request: string;
  additions: string[];
  changes: string[];
  removals: string[];
}): Promise<ChangeContract> {
  const project = await requireOwnedProject(input.userId, input.projectId);
  if (!project.productContract)
    throw new Error("Project has no ProductContract to evolve");

  const contract = createChangeContract({
    projectId: input.projectId,
    originalProductContract: project.productContract,
    request: input.request,
    additions: input.additions,
    changes: input.changes,
    removals: input.removals,
  });
  const validation = validateChangeContract(contract);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  await db.execute(sql`
    INSERT INTO project_change_contracts (
      project_id, user_id, base_product_contract_hash, contract, status
    ) VALUES (
      ${input.projectId}, ${input.userId}, ${contract.originalProductContractHash},
      ${JSON.stringify(contract)}::jsonb, 'validated'
    )
  `);
  return contract;
}

export async function listProjectChangeContracts(
  userId: number,
  projectId: number,
) {
  await requireOwnedProject(userId, projectId);
  const result = await db.execute<{
    id: number;
    contract: ChangeContract;
    status: string;
    created_at: Date;
    applied_at: Date | null;
  }>(sql`
    SELECT id, contract, status, created_at, applied_at
    FROM project_change_contracts
    WHERE project_id = ${projectId} AND user_id = ${userId}
    ORDER BY created_at DESC
  `);
  return rows(result);
}

export async function persistSupportCase(input: {
  userId: number;
  projectId?: number | null;
  buildRef?: string | null;
  severity: SupportSeverity;
  category: string;
  customerSummary: string;
}) {
  if (input.projectId) await requireOwnedProject(input.userId, input.projectId);
  const support = createSupportCase(input);
  await db.execute(sql`
    INSERT INTO support_cases (
      case_ref, user_id, project_id, build_ref, severity, category, status,
      customer_summary, internal_notes, log_refs, billing_adjustment,
      resolution, root_cause, prevention
    ) VALUES (
      ${support.caseRef}, ${support.userId}, ${support.projectId}, ${support.buildRef},
      ${support.severity}, ${support.category}, ${support.status},
      ${support.customerSummary}, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL
    )
  `);
  return support;
}

export async function listMySupportCases(userId: number) {
  const result = await db.execute<{
    case_ref: string;
    project_id: number | null;
    build_ref: string | null;
    severity: SupportSeverity;
    category: string;
    status: string;
    customer_summary: string;
    billing_adjustment: unknown;
    resolution: string | null;
    created_at: Date;
    updated_at: Date;
  }>(sql`
    SELECT case_ref, project_id, build_ref, severity, category, status,
      customer_summary, billing_adjustment, resolution, created_at, updated_at
    FROM support_cases
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `);
  return rows(result);
}
