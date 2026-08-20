export interface RequirementExtraction {
  appName: string;
  description: string;
  features: string[];
  targetAudience: string;
  technicalRequirements: string[];
  integrations: string[];
  dataModels: string[];
  userRoles: string[];
}

export interface ClarificationQuestion {
  question: string;
  category: 'feature' | 'design' | 'technical' | 'business';
  priority: 'high' | 'medium' | 'low';
}

async function callOpenAI(system: string, user: string, maxTokens: number): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const model = process.env.AI_MODEL || 'gpt-4-turbo';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    const msg =
      (data && (data.error?.message || data.message)) ||
      `OpenAI request failed: ${response.status}`;
    throw new Error(String(msg));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned an empty response');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse OpenAI JSON response');
  }
}

export class AIService {
  async extractRequirements(prompt: string): Promise<RequirementExtraction> {
    const parsed = (await callOpenAI(
      `You are an expert software architect. Extract requirements from the user's app description. Return a JSON object with:
- appName: string
- description: string
- features: string[]
- targetAudience: string
- technicalRequirements: string[]
- integrations: string[]
- dataModels: string[]
- userRoles: string[]`,
      prompt,
      4000
    )) as RequirementExtraction;

    if (!parsed?.appName || !parsed?.description) {
      throw new Error('Requirement extraction returned incomplete data');
    }
    return {
      appName: parsed.appName,
      description: parsed.description,
      features: parsed.features ?? [],
      targetAudience: parsed.targetAudience ?? '',
      technicalRequirements: parsed.technicalRequirements ?? [],
      integrations: parsed.integrations ?? [],
      dataModels: parsed.dataModels ?? [],
      userRoles: parsed.userRoles ?? [],
    };
  }

  async generateClarificationQuestions(
    requirements: RequirementExtraction
  ): Promise<ClarificationQuestion[]> {
    const parsed = await callOpenAI(
      `Generate 3-5 clarification questions to better understand the app requirements. Return a JSON array of objects with:
- question: string
- category: 'feature' | 'design' | 'technical' | 'business'
- priority: 'high' | 'medium' | 'low'`,
      `Based on these requirements: ${JSON.stringify(requirements)}`,
      2000
    );

    if (!Array.isArray(parsed)) {
      throw new Error('Clarification questions response was not an array');
    }
    return parsed as ClarificationQuestion[];
  }

  async generateAppArchitecture(requirements: RequirementExtraction) {
    return callOpenAI(
      `Generate a complete app architecture. Return a JSON object with:
- frontend: { framework: string, components: string[], pages: string[] }
- backend: { framework: string, endpoints: string[], services: string[] }
- database: { type: string, tables: string[], relationships: string[] }
- infrastructure: { deployment: string, monitoring: string, backups: string }
- security: { auth: string, rateLimiting: string, encryption: string }`,
      `Create architecture for: ${JSON.stringify(requirements)}`,
      4000
    );
  }
}

export default AIService;
