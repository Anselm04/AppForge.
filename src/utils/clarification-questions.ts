import { ParsedRequirements } from './requirement-parser.js';

export interface ClarificationQuestion {
  question: string;
  category: 'feature' | 'design' | 'technical' | 'business';
  priority: 'high' | 'medium' | 'low';
}

export function generateClarificationQuestions(requirements: ParsedRequirements): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  
  // Feature questions
  if (requirements.features.includes('authentication')) {
    questions.push({
      question: 'What authentication methods do you need? (Email/password, OAuth, SSO, etc.)',
      category: 'feature',
      priority: 'high',
    });
  }
  
  if (requirements.features.includes('dashboard')) {
    questions.push({
      question: 'What metrics or data should be displayed on the dashboard?',
      category: 'feature',
      priority: 'high',
    });
  }
  
  // Design questions
  if (requirements.type === 'web') {
    questions.push({
      question: 'Do you have a preferred color scheme or design style?',
      category: 'design',
      priority: 'medium',
    });
  }
  
  // Technical questions
  if (requirements.features.includes('database')) {
    questions.push({
      question: 'What type of data will you be storing? Any specific requirements?',
      category: 'technical',
      priority: 'high',
    });
  }
  
  // Business questions
  questions.push({
    question: 'Who is your target audience for this app?',
    category: 'business',
    priority: 'medium',
  });
  
  // Limit to top 5 questions
  return questions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);
}

export default generateClarificationQuestions;
