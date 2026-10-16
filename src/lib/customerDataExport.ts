import { asc, eq } from "drizzle-orm";
import {
  db,
  getCreditTransactions,
  getGithubConnection,
  getProjectFiles,
  getProjectsByUserId,
  getSubscriptionByUserId,
  getUserById,
  getUserCredits,
} from "../db.js";
import * as schema from "../db/schema.js";

type ExportUser = {
  id: number;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type ExportProject = {
  id: number;
  userId: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  techStack?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type ExportBuildHistory = {
  projectId: number;
  version?: number | null;
  status?: string | null;
  isCurrent?: boolean | null;
  createdAt?: Date | null;
};

type ExportSubscription = {
  status?: string | null;
  tier?: string | null;
  trialEnd?: Date | null;
  currentPeriodEnd?: Date | null;
};

type ExportCredits = {
  balance?: number | null;
  tier?: string | null;
  monthlyAllowance?: number | null;
  unlimited?: boolean | null;
};

type ExportCreditTransaction = {
  amount: number;
  type: string;
  projectId?: number | null;
  description?: string | null;
  createdAt?: Date | null;
};

type ExportGithubConnection = {
  githubUsername?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CustomerDataExportLoaders = {
  getUserById(userId: number): Promise<ExportUser | undefined>;
  getProjectsByUserId(userId: number): Promise<ExportProject[]>;
  getProjectFiles(projectId: number): Promise<Record<string, string>>;
  getBuildHistory(projectId: number): Promise<ExportBuildHistory[]>;
  getSubscriptionByUserId(
    userId: number,
  ): Promise<ExportSubscription | undefined>;
  getUserCredits(userId: number): Promise<ExportCredits | undefined>;
  getCreditTransactions(userId: number): Promise<ExportCreditTransaction[]>;
  getGithubConnection(
    userId: number,
  ): Promise<ExportGithubConnection | undefined>;
};

const DEFAULT_CUSTOMER_DATA_EXPORT_LOADERS: CustomerDataExportLoaders = {
  getUserById,
  getProjectsByUserId,
  getProjectFiles,
  getBuildHistory: async (projectId) => {
    const snapshots = await db.query.buildSnapshots.findMany({
      where: eq(schema.buildSnapshots.projectId, projectId),
      orderBy: asc(schema.buildSnapshots.version),
    });
    return snapshots.map((snapshot) => ({
      projectId: snapshot.projectId,
      version: snapshot.version,
      status: snapshot.isCurrent ? "current" : "historical",
      isCurrent: snapshot.isCurrent,
      createdAt: snapshot.createdAt,
    }));
  },
  getSubscriptionByUserId,
  getUserCredits,
  getCreditTransactions,
  getGithubConnection,
};

function iso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

export async function buildCustomerDataExport(
  userId: number,
  loaders: CustomerDataExportLoaders = DEFAULT_CUSTOMER_DATA_EXPORT_LOADERS,
) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Account identifier is invalid");
  }

  const user = await loaders.getUserById(userId);
  if (!user) throw new Error("Account not found");
  if (user.id !== userId) throw new Error("Account ownership mismatch");

  const projects = await loaders.getProjectsByUserId(userId);
  if (projects.some((project) => project.userId !== userId)) {
    throw new Error("Project ownership mismatch in customer export");
  }

  const exportedProjects = await Promise.all(
    projects.map(async (project) => {
      const [files, history] = await Promise.all([
        loaders.getProjectFiles(project.id),
        loaders.getBuildHistory(project.id),
      ]);
      return {
        id: project.id,
        title: project.title ?? null,
        description: project.description ?? null,
        status: project.status ?? null,
        techStack: project.techStack ?? null,
        createdAt: iso(project.createdAt),
        updatedAt: iso(project.updatedAt),
        files,
        buildHistory: history.map((entry) => ({
          projectId: entry.projectId,
          version: entry.version ?? null,
          status: entry.status ?? (entry.isCurrent ? "current" : "historical"),
          isCurrent: entry.isCurrent ?? null,
          createdAt: iso(entry.createdAt),
        })),
      };
    }),
  );

  const [subscription, credits, transactions, github] = await Promise.all([
    loaders.getSubscriptionByUserId(userId),
    loaders.getUserCredits(userId),
    loaders.getCreditTransactions(userId),
    loaders.getGithubConnection(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      picture: user.picture ?? null,
      createdAt: iso(user.createdAt),
      updatedAt: iso(user.updatedAt),
    },
    projects: exportedProjects,
    billing: {
      tier: subscription?.tier ?? credits?.tier ?? "free",
      status: subscription?.status ?? "none",
      trialEnd: iso(subscription?.trialEnd),
      currentPeriodEnd: iso(subscription?.currentPeriodEnd),
      creditBalance: credits?.balance ?? 0,
      monthlyAllowance: credits?.monthlyAllowance ?? 0,
      unlimited: credits?.unlimited ?? false,
      creditTransactions: transactions.map((transaction) => ({
        amount: transaction.amount,
        type: transaction.type,
        projectId: transaction.projectId ?? null,
        description: transaction.description ?? null,
        createdAt: iso(transaction.createdAt),
      })),
    },
    connections: {
      github: github
        ? {
            username: github.githubUsername ?? null,
            connectedAt: iso(github.createdAt),
            updatedAt: iso(github.updatedAt),
            status: "connected" as const,
          }
        : {
            username: null,
            connectedAt: null,
            updatedAt: null,
            status: "not_connected" as const,
          },
    },
  };
}
