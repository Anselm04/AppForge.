export interface ParsedRequirements {
  appName: string;
  type: 'web' | 'mobile' | 'api' | 'tool';
  features: string[];
  integrations: string[];
  dataModels: string[];
  userRoles: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

export function parseRequirements(prompt: string): ParsedRequirements {
  const lowerPrompt = prompt.toLowerCase();
  
  // Determine app type
  let type: ParsedRequirements['type'] = 'web';
  if (lowerPrompt.includes('mobile') || lowerPrompt.includes('ios') || lowerPrompt.includes('android')) {
    type = 'mobile';
  } else if (lowerPrompt.includes('api') || lowerPrompt.includes('backend')) {
    type = 'api';
  } else if (lowerPrompt.includes('tool') || lowerPrompt.includes('utility')) {
    type = 'tool';
  }
  
  // Extract features (simple keyword matching)
  const featureKeywords = [
    'authentication', 'login', 'signup',
    'dashboard', 'analytics', 'charts',
    'database', 'storage',
    'api', 'integration',
    'real-time', 'websocket',
    'file upload', 'images',
    'search', 'filter',
    'notifications', 'email',
    'payment', 'stripe',
    'admin', 'management',
  ];
  
  const features = featureKeywords.filter(keyword => lowerPrompt.includes(keyword));
  
  // Determine complexity
  let complexity: ParsedRequirements['complexity'] = 'simple';
  if (features.length > 5 || lowerPrompt.includes('complex') || lowerPrompt.includes('enterprise')) {
    complexity = 'complex';
  } else if (features.length > 2) {
    complexity = 'medium';
  }
  
  return {
    appName: 'Generated App',
    type,
    features,
    integrations: [],
    dataModels: [],
    userRoles: ['user'],
    complexity,
  };
}

export default parseRequirements;
