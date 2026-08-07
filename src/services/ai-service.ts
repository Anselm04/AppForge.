import { z } from 'zod';

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

export class AIService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gpt-4-turbo';
  }

  async extractRequirements(prompt: string): Promise<RequirementExtraction> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        max_tokens: 4000,
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

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  async generateClarificationQuestions(requirements: RequirementExtraction): Promise<ClarificationQuestion[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
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

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  async generateAppArchitecture(requirements: RequirementExtraction) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        max_tokens: 4000,
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

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

export default AIService;
