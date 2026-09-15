import { Router, type Request } from "express";
import {
  getAgentLogsByProject,
  getProjectById,
  getProjectsByUserId,
  getUserCredits,
  getUserTier,
} from "../db.js";

export const mcpRouter = Router();

export const MCP_PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = { name: "appforge", version: "1.0.0" } as const;

export const MCP_RESOURCES = [
  {
    uri: "appforge://account",
    name: "AppForge account status",
    description:
      "Authenticated tier and credit status for the current AppForge account.",
    mimeType: "application/json",
  },
  {
    uri: "appforge://projects",
    name: "AppForge projects",
    description:
      "Safe metadata for projects owned by the authenticated AppForge user.",
    mimeType: "application/json",
  },
] as const;

export const MCP_RESOURCE_TEMPLATES = [
  {
    uriTemplate: "appforge://projects/{projectId}",
    name: "AppForge project",
    description:
      "Safe metadata for one project owned by the authenticated user.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "appforge://projects/{projectId}/agent-logs",
    name: "AppForge project agent logs",
    description:
      "Agent progress logs for one project owned by the authenticated user.",
    mimeType: "application/json",
  },
] as const;

export const MCP_PROMPTS = [
  {
    name: "review_project_status",
    title: "Review AppForge project status",
    description:
      "Guide an interoperable agent through a safe project status and agent-log review.",
    arguments: [
      {
        name: "projectId",
        description: "Positive AppForge project ID",
        required: true,
      },
    ],
  },
] as const;

export const MCP_TOOLS = [
  {
    name: "list_projects",
    title: "List AppForge projects",
    description:
      "List the authenticated user's AppForge projects without exposing generated source files or secrets.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_project",
    title: "Get AppForge project",
    description:
      "Get safe metadata for one AppForge project owned by the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "integer", minimum: 1 },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_agent_logs",
    title: "Get AppForge agent logs",
    description:
      "Read agent progress logs for one project owned by the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "integer", minimum: 1 },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_account_status",
    title: "Get AppForge account status",
    description:
      "Read the authenticated user's AppForge tier, credit balance and unlimited-access status.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_deploy_destinations",
    title: "Get AppForge deployment destinations",
    description:
      "List deployment destinations currently supported by AppForge. This tool does not start a deployment.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, any>;
};

function serverMeta() {
  return {
    "io.modelcontextprotocol/serverInfo": SERVER_INFO,
  };
}

function modernResult(result: Record<string, any>, modern: boolean) {
  return modern
    ? {
        resultType: "complete",
        ...result,
        _meta: { ...(result._meta ?? {}), ...serverMeta() },
      }
    : result;
}

function rpcResult(id: JsonRpcId, result: Record<string, any>) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, any>,
) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data ? { data } : {}) },
  };
}

function integerArgument(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function safeProject(project: any) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    techStack: project.techStack,
    status: project.status,
    errorMessage: project.errorMessage,
    pauseReason: project.pauseReason,
    creditsSpent: project.creditsSpent,
    creditsReserved: project.creditsReserved,
    locale: project.locale,
    buildCapabilities: project.buildCapabilities ?? [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function toolResult(data: unknown, modern: boolean, isError = false) {
  return modernResult(
    {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
      isError,
    },
    modern,
  );
}

export function validateModernMcpHeaders(
  req: Pick<Request, "get">,
  body: JsonRpcRequest,
): string | null {
  const version = req.get("mcp-protocol-version");
  if (version !== MCP_PROTOCOL_VERSION) {
    return `MCP-Protocol-Version must be ${MCP_PROTOCOL_VERSION}`;
  }

  const headerMethod = req.get("mcp-method");
  if (!headerMethod || headerMethod !== body.method) {
    return "Mcp-Method header must match the JSON-RPC method";
  }

  const bodyName =
    body.method === "tools/call" && typeof body.params?.name === "string"
      ? body.params.name
      : null;
  const headerName = req.get("mcp-name");
  if (bodyName && headerName !== bodyName) {
    return "Mcp-Name header must match params.name";
  }
  if (!bodyName && headerName) {
    return "Mcp-Name is only valid when the MCP method names a target";
  }
  return null;
}

async function callTool(
  userId: number,
  name: string,
  args: Record<string, any>,
) {
  switch (name) {
    case "list_projects": {
      const projects = await getProjectsByUserId(userId);
      const items = projects.map(safeProject);
      return { items, count: items.length };
    }

    case "get_project": {
      const projectId = integerArgument(args.projectId);
      if (!projectId) throw new Error("projectId must be a positive integer");
      const project = await getProjectById(projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found or access denied");
      }
      return safeProject(project);
    }

    case "get_agent_logs": {
      const projectId = integerArgument(args.projectId);
      if (!projectId) throw new Error("projectId must be a positive integer");
      const project = await getProjectById(projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found or access denied");
      }
      const logs = await getAgentLogsByProject(projectId);
      return {
        projectId,
        logs: logs.map((log: any) => ({
          id: log.id,
          agent: log.agent,
          content: log.content,
          isComplete: log.isComplete,
          creditsCharged: log.creditsCharged,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt,
        })),
      };
    }

    case "get_account_status": {
      const [tier, credits] = await Promise.all([
        getUserTier(userId),
        getUserCredits(userId),
      ]);
      return {
        tier,
        credits: credits?.balance ?? 0,
        unlimited: !!credits?.unlimited || tier === "lifetime",
        monthlyAllowance: credits?.monthlyAllowance ?? 0,
      };
    }

    case "get_deploy_destinations": {
      const { listDeployDestinations } =
        await import("../services/deployer.js");
      return { destinations: listDeployDestinations() };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function readResource(userId: number, uri: string) {
  if (uri === "appforge://account") {
    const [tier, credits] = await Promise.all([
      getUserTier(userId),
      getUserCredits(userId),
    ]);
    return {
      tier,
      credits: credits?.balance ?? 0,
      unlimited: !!credits?.unlimited || tier === "lifetime",
      monthlyAllowance: credits?.monthlyAllowance ?? 0,
    };
  }
  if (uri === "appforge://projects") {
    const projects = await getProjectsByUserId(userId);
    const items = projects.map(safeProject);
    return { items, count: items.length };
  }
  const projectMatch = uri.match(/^appforge:\/\/projects\/(\d+)$/);
  const logsMatch = uri.match(/^appforge:\/\/projects\/(\d+)\/agent-logs$/);
  const rawId = projectMatch?.[1] ?? logsMatch?.[1];
  const projectId = rawId ? Number(rawId) : null;
  if (!projectId || !Number.isSafeInteger(projectId) || projectId <= 0)
    throw new Error("Resource not found");
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId)
    throw new Error("Resource not found or access denied");
  if (logsMatch) {
    const logs = await getAgentLogsByProject(projectId);
    return {
      projectId,
      logs: logs.map((log: any) => ({
        id: log.id,
        agent: log.agent,
        content: log.content,
        isComplete: log.isComplete,
        creditsCharged: log.creditsCharged,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
    };
  }
  return safeProject(project);
}

export function buildProjectReviewPrompt(projectId: number) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0)
    throw new Error("projectId must be a positive integer");
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Review AppForge project ${projectId}. Use get_project first, then get_agent_logs. Summarize current status, blockers, recent agent activity, and the safest next action. Do not request or expose secrets, generated source files, credentials, or data from another user's project.`,
      },
    },
  ];
}

mcpRouter.post("/", async (req, res) => {
  const body = req.body as JsonRpcRequest;
  const id = body?.id ?? null;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(rpcError(id, -32001, "Unauthorized"));
  }
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return res.status(400).json(rpcError(id, -32600, "Invalid Request"));
  }

  const modern =
    req.get("mcp-protocol-version") === MCP_PROTOCOL_VERSION ||
    body.params?._meta?.["io.modelcontextprotocol/protocolVersion"] ===
      MCP_PROTOCOL_VERSION;

  if (modern) {
    const headerError = validateModernMcpHeaders(req, body);
    if (headerError) {
      return res
        .status(400)
        .json(rpcError(id, -32020, "HeaderMismatch", { detail: headerError }));
    }
  }

  try {
    switch (body.method) {
      case "server/discover":
        return res.json(
          rpcResult(
            id,
            modernResult(
              {
                supportedVersions: [
                  MCP_PROTOCOL_VERSION,
                  LEGACY_PROTOCOL_VERSION,
                ],
                capabilities: {
                  tools: { listChanged: false },
                  resources: { subscribe: false, listChanged: false },
                  prompts: { listChanged: false },
                },
                instructions:
                  "Use AppForge tools to inspect only the authenticated user's projects, account state and supported deployment destinations. Write actions are intentionally not exposed in this first hardened MCP surface.",
                ttlMs: 300000,
                cacheScope: "private",
              },
              true,
            ),
          ),
        );

      case "initialize": {
        const requested = body.params?.protocolVersion;
        const protocolVersion =
          requested === MCP_PROTOCOL_VERSION
            ? MCP_PROTOCOL_VERSION
            : LEGACY_PROTOCOL_VERSION;
        return res.json(
          rpcResult(id, {
            protocolVersion,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: SERVER_INFO,
            instructions:
              "Authenticated AppForge project inspection tools. Write actions are not exposed by this endpoint.",
          }),
        );
      }

      case "notifications/initialized":
        return res.status(202).end();

      case "ping":
        return res.json(rpcResult(id, modernResult({}, modern)));

      case "resources/list":
        return res.json(
          rpcResult(id, modernResult({ resources: MCP_RESOURCES }, modern)),
        );

      case "resources/templates/list":
        return res.json(
          rpcResult(
            id,
            modernResult({ resourceTemplates: MCP_RESOURCE_TEMPLATES }, modern),
          ),
        );

      case "resources/read": {
        const uri = body.params?.uri;
        if (typeof uri !== "string" || uri.length > 512)
          return res.status(400).json(rpcError(id, -32602, "Invalid params"));
        try {
          const data = await readResource(userId, uri);
          return res.json(
            rpcResult(
              id,
              modernResult(
                {
                  contents: [
                    {
                      uri,
                      mimeType: "application/json",
                      text: JSON.stringify(data),
                    },
                  ],
                },
                modern,
              ),
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Resource read failed";
          return res.status(404).json(rpcError(id, -32002, message));
        }
      }

      case "prompts/list":
        return res.json(
          rpcResult(id, modernResult({ prompts: MCP_PROMPTS }, modern)),
        );

      case "prompts/get": {
        if (body.params?.name !== "review_project_status")
          return res.status(404).json(rpcError(id, -32601, "Prompt not found"));
        const rawProjectId = body.params?.arguments?.projectId;
        const projectId =
          typeof rawProjectId === "number"
            ? rawProjectId
            : typeof rawProjectId === "string" && /^\d+$/.test(rawProjectId)
              ? Number(rawProjectId)
              : null;
        if (!projectId || !Number.isSafeInteger(projectId) || projectId <= 0)
          return res.status(400).json(rpcError(id, -32602, "Invalid params"));
        const project = await getProjectById(projectId);
        if (!project || project.userId !== userId)
          return res
            .status(404)
            .json(rpcError(id, -32002, "Project not found"));
        return res.json(
          rpcResult(
            id,
            modernResult(
              {
                description: "Safe AppForge project status review",
                messages: buildProjectReviewPrompt(projectId),
              },
              modern,
            ),
          ),
        );
      }

      case "tools/list":
        return res.json(
          rpcResult(
            id,
            modernResult(
              {
                tools: MCP_TOOLS,
                ttlMs: 300000,
                cacheScope: "private",
              },
              modern,
            ),
          ),
        );

      case "tools/call": {
        const name = body.params?.name;
        const args = body.params?.arguments ?? {};
        if (typeof name !== "string") {
          return res.status(400).json(rpcError(id, -32602, "Invalid params"));
        }
        if (!MCP_TOOLS.some((tool) => tool.name === name)) {
          return res.status(404).json(rpcError(id, -32601, "Tool not found"));
        }
        try {
          const output = await callTool(userId, name, args);
          return res.json(rpcResult(id, toolResult(output, modern)));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Tool execution failed";
          return res.json(
            rpcResult(id, toolResult({ error: message }, modern, true)),
          );
        }
      }

      default:
        return res.status(404).json(rpcError(id, -32601, "Method not found"));
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MCP request failed";
    return res
      .status(500)
      .json(rpcError(id, -32603, "Internal error", { message }));
  }
});
