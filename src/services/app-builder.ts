import { CodeGenerator } from './code-generator';
import { AIService } from './ai-service';

export interface GeneratedApp {
  id: string;
  name: string;
  description: string;
  frontend: any;
  backend: any;
  database: any;
  infrastructure: any;
  /** Present only after a real deploy succeeds — never fabricated */
  previewUrl?: string;
  deployUrl?: string;
  status: 'building' | 'ready' | 'failed';
  error?: string;
}

export class AppBuilder {
  private aiService: AIService;
  private codeGenerator: CodeGenerator;

  constructor() {
    this.aiService = new AIService();
    this.codeGenerator = new CodeGenerator();
  }

  async build(requirements: any): Promise<GeneratedApp> {
    const appId = `app_${Date.now()}`;

    const architecture = await this.aiService.generateAppArchitecture(requirements);

    const frontend = await this.codeGenerator.generateFrontend(requirements, architecture);
    const backend = await this.codeGenerator.generateBackend(requirements, architecture);
    const database = await this.codeGenerator.generateDatabase(requirements, architecture);

    return {
      id: appId,
      name: requirements.appName,
      description: requirements.description,
      frontend,
      backend,
      database,
      infrastructure: architecture.infrastructure,
      status: 'ready',
    };
  }

  async iterate(_appId: string, _changes: any): Promise<GeneratedApp> {
    throw new Error(
      'App iteration is not implemented yet. Rebuild with updated requirements instead.'
    );
  }

  /**
   * Real Vercel deployment is not wired in this module yet.
   * Must not return a fabricated URL.
   */
  async deploy(_appId: string): Promise<string> {
    throw new Error(
      'Vercel deployment is not configured in AppBuilder. Use the verified deployment path once GitHub export and Vercel API credentials are set.'
    );
  }

  /**
   * Real GitHub export is not wired in this module yet.
   * Must not return a fabricated repository URL.
   */
  async exportToGitHub(_appId: string, _repoName: string): Promise<string> {
    throw new Error(
      'GitHub export is not configured in AppBuilder. Use the github router with a connected OAuth token once available.'
    );
  }
}

export default AppBuilder;
