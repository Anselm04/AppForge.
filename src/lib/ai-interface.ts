import { z } from 'zod';

export interface AIInterfaceConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

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

const config: AIInterfaceConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 4000,
};

export async function extractRequirements(prompt: string): Promise<RequirementExtraction> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'system',
          content: `You are an expert software architect. Extract requirements from the user's app description. Return a JSON object with:
- appName: string
- description: string
- features: string[]
- targetAudience: string
- technicalRequirements: string[]
- integrations: string[]
- dataModels: string[]
- userRoles: string[]`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json() as any;
  const content = JSON.parse(data.choices[0].message.content);
  return content;
}

export async function generateClarificationQuestions(
  requirements: RequirementExtraction
): Promise<ClarificationQuestion[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `Generate 3-5 clarification questions to better understand the app requirements. Return a JSON array of objects with:
- question: string
- category: 'feature' | 'design' | 'technical' | 'business'
- priority: 'high' | 'medium' | 'low'`,
        },
        {
          role: 'user',
          content: `Based on these requirements: ${JSON.stringify(requirements)}`,
        },
      ],
    }),
  });

  const data = await response.json() as any;
  return JSON.parse(data.choices[0].message.content);
}

export async function generateAppArchitecture(requirements: RequirementExtraction): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'system',
          content: `Generate a complete app architecture. Return a JSON object with:
- frontend: { framework: string, components: string[], pages: string[] }
- backend: { framework: string, endpoints: string[], services: string[] }
- database: { type: string, tables: string[], relationships: string[] }
- infrastructure: { deployment: string, monitoring: string, backups: string }
- security: { auth: string, rateLimiting: string, encryption: string }`,
        },
        {
          role: 'user',
          content: `Create architecture for: ${JSON.stringify(requirements)}`,
        },
      ],
    }),
  });

  const data = await response.json() as any;
  return JSON.parse(data.choices[0].message.content);
}

export default { extractRequirements, generateClarificationQuestions, generateAppArchitecture };
