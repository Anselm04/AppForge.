import { Composio } from "@composio/core";

export interface ComposioSessionLike {
  execute(toolSlug: string, args: Record<string, unknown>): Promise<unknown>;
}

let composioClient: Composio | null = null;

export function isComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function buildComposioUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized)
    throw new Error("Composio requires a non-empty AppForge user ID");
  return `appforge:${normalized}`;
}

export function getComposioClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is not configured");
  }

  if (!composioClient) {
    composioClient = new Composio({ apiKey });
  }
  return composioClient;
}

export async function createComposioSession(
  appForgeUserId: string,
): Promise<ComposioSessionLike> {
  const client = getComposioClient();
  return client.create(buildComposioUserId(appForgeUserId));
}

export async function searchComposioTools(
  session: ComposioSessionLike,
  useCase: string,
): Promise<unknown> {
  const normalized = useCase.trim();
  if (!normalized) throw new Error("Composio tool search requires a use case");

  return session.execute("COMPOSIO_SEARCH_TOOLS", {
    queries: [{ use_case: normalized }],
    session: { generate_id: true },
  });
}
