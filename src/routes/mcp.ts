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

export const MCP_TOOLS = [
  {
    name: "list_projects",
    title: "List AppForge projects",
    description:
      "List the authenticated user's AppForge projects without exposing generated source files or secrets.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
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
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_deploy_destinations",
    title: "Get AppForge deployment destinations",
    description:
      "List deployment destinations currently supported by AppForge. This tool does not start a deployment.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
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

async function callTool(userId: number, name: string, args: Record<string, any>) {
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
      const { listDeployDestinations } = await import("../services/deployer.js");
      return { destinations: listDeployDestinations() };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
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
                supportedVersions: [MCP_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION],
                capabilities: { tools: { listChanged: false } },
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
          requested === LEGACY_PROTOCOL_VERSION
            ? LEGACY_PROTOCOL_VERSION
            : LEGACY_PROTOCOL_VERSION;
        return res.json(
          rpcResult(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
              "Authenticated AppForge project inspection tools. Write actions are not exposed by this endpoint.",
          }),
        );
      }

      case "notifications/initialized":
        return res.status(202).end();

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
    const message = error instanceof Error ? error.message : "MCP request failed";
    return res.status(500).json(rpcError(id, -32603, "Internal error", { message }));
  }
});
