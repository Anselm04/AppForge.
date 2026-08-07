export interface Customization {
  name?: string;
  description?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
  };
  features?: {
    enabled?: string[];
    disabled?: string[];
  };
  integrations?: {
    stripe?: boolean;
    email?: boolean;
    analytics?: boolean;
  };
}

export function customizeTemplate(template: any, customization: Customization): any {
  const customized = { ...template };

  if (customization.name) {
    customized.name = customization.name;
  }

  if (customization.description) {
    customized.description = customization.description;
  }

  if (customization.branding) {
    customized.branding = { ...customized.branding, ...customization.branding };
  }

  if (customization.features) {
    if (customization.features.enabled) {
      customized.features = [...customized.features, ...customization.features.enabled];
    }
    if (customization.features.disabled) {
      customized.features = customized.features.filter(
        (f: string) => !customization.features!.disabled!.includes(f)
      );
    }
  }

  if (customization.integrations) {
    customized.integrations = { ...customized.integrations, ...customization.integrations };
  }

  return customized;
}

export default customizeTemplate;
