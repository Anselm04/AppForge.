import { useState, useCallback } from 'react';
import { extractRequirements, generateClarificationQuestions } from '../lib/ai-interface';
import generateApp from '../lib/app-generator';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'question' | 'clarification' | 'building' | 'complete';
}

interface AppData {
  name: string;
  description: string;
  previewUrl: string;
  deployUrl: string;
  features: string[];
  components: string[];
  status: 'building' | 'ready';
}

export function useAIBuilder() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [requirements, setRequirements] = useState<any>(null);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Check if this is the first message (app description)
    if (messages.length === 0) {
      setIsBuilding(true);
      
      try {
        // Extract requirements
        const extracted = await extractRequirements(content);
        setRequirements(extracted);

        // Generate clarification questions
        const questions = await generateClarificationQuestions(extracted);
        
        // Add assistant message with clarification questions
        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: `Great! I understand you want to build **${extracted.appName}**.\n\nBefore I start building, let me clarify a few things:\n\n` + 
            questions.map(q => `**${q.question}**`).join('\n\n'),
          timestamp: new Date(),
          type: 'question',
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Start building app in background
        const generatedApp = await generateApp(extracted);
        
        setAppData({
          name: generatedApp.name,
          description: generatedApp.description,
          previewUrl: generatedApp.previewUrl,
          deployUrl: generatedApp.deployUrl,
          features: extracted.features,
          components: [...generatedApp.frontend.components, ...generatedApp.backend.services],
          status: 'ready',
        });

        // Add completion message
        const completeMessage: Message = {
          id: `msg_${Date.now() + 2}`,
          role: 'assistant',
          content: `🎉 Your app **${extracted.appName}** is ready!\n\nI've built:\n- ✅ Frontend with React + TypeScript + Tailwind\n- ✅ Backend with Express + tRPC\n- ✅ Database with PostgreSQL + Drizzle ORM\n- ✅ Authentication with JWT\n- ✅ Rate limiting and security headers\n- ✅ Monitoring with Prometheus + Grafana\n- ✅ CI/CD pipeline with GitHub Actions\n- ✅ Automated backups\n- ✅ Complete documentation\n\nYou can preview it on the right, or deploy it with one click!`,
          timestamp: new Date(),
          type: 'complete',
        };
        setMessages(prev => [...prev, completeMessage]);
        
      } catch (error) {
        console.error('Error building app:', error);
        const errorMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error building your app. Please try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsBuilding(false);
      }
    } else {
      // Handle follow-up messages
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `Thanks for the clarification! I'll update the app accordingly.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  }, [messages.length]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsBuilding(false);
    setAppData(null);
    setRequirements(null);
  }, []);

  return {
    messages,
    isBuilding,
    appData,
    sendMessage,
    clearChat,
  };
}

export default useAIBuilder;
