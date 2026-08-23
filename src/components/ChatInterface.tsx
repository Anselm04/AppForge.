import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'question' | 'clarification' | 'building' | 'complete';
}

interface ChatInterfaceProps {
  messages: Message[];
  isBuilding: boolean;
  onSendMessage: (message: string) => void;
  onClear: () => void;
}

export function ChatInterface({ messages, isBuilding, onSendMessage, onClear }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const getAssistantIcon = (message: Message) => {
    if (message.type === 'question') return '❓';
    if (message.type === 'clarification') return '💡';
    if (message.type === 'building') return '⚙️';
    if (message.type === 'complete') return '✅';
    return '🤖';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Welcome to AppForge!</h3>
            <p className="text-gray-500 mb-4">Tell me about the app you want to build</p>
            <div className="text-sm text-gray-400 space-y-2">
              <p>Examples:</p>
              <p>• "I need a task management app with drag-and-drop boards"</p>
              <p>• "Build a CRM to track customers and sales"</p>
              <p>• "Create a fitness tracking app with workout logging"</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-lg">
              {message.role === 'user' ? '👤' : getAssistantIcon(message)}
            </div>
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'question'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : message.type === 'building'
                  ? 'bg-blue-50 border border-blue-200'
                  : message.type === 'complete'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isBuilding && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-lg">
              ⚙️
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p className="text-sm text-blue-900">Building your app...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your app idea..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isBuilding}
          />
          <button
            type="submit"
            disabled={!input.trim() || isBuilding}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatInterface;
