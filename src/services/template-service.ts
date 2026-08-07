import { templates } from '../data/templates';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  useCases: string[];
  image: string;
  previewUrl: string;
  deployUrl: string;
  rating: number;
  reviews: number;
  features: string[];
  techStack: string[];
}

export class TemplateService {
  async getTemplates(): Promise<Template[]> {
    return templates;
  }

  async getTemplateById(id: string): Promise<Template | undefined> {
    return templates.find(t => t.id === id);
  }

  async searchTemplates(query: string): Promise<Template[]> {
    const lowerQuery = query.toLowerCase();
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.features.some(f => f.toLowerCase().includes(lowerQuery))
    );
  }

  async filterTemplates(category?: string, useCase?: string): Promise<Template[]> {
    return templates.filter(t => {
      if (category && t.category !== category) return false;
      if (useCase && !t.useCases.includes(useCase)) return false;
      return true;
    });
  }

  async deployTemplate(templateId: string): Promise<string> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    return template.deployUrl;
  }

  async customizeTemplate(templateId: string, customization: any): Promise<Template> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Apply customization
    const customized: Template = {
      ...template,
      name: customization.name || template.name,
      description: customization.description || template.description,
    };

    return customized;
  }
}

export default TemplateService;
