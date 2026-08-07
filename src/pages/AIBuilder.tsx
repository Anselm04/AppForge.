import { useState } from 'react';
import { ChatInterface } from '../components/ChatInterface';
import { AppPreview } from '../components/AppPreview';
import { useAIBuilder } from '../hooks/useAIBuilder';

export function AIBuilder() {
  const { messages, isBuilding, appData, sendMessage, clearChat } = useAIBuilder();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel: Chat Interface */}
      <div className="w-1/2 border-r border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-2xl font-bold text-gray-900">🚀 AppForge AI Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Describe your app idea and watch it come to life</p>
        </div>
        
        <ChatInterface
          messages={messages}
          isBuilding={isBuilding}
          onSendMessage={sendMessage}
          onClear={clearChat}
        />
      </div>

      {/* Right Panel: App Preview */}
      <div className="w-1/2 bg-white">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Live Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            {appData && (
              <button
                onClick={() => window.open(appData.previewUrl, '_blank')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Open Preview
              </button>
            )}
          </div>
        </div>

        {showPreview && appData ? (
          <AppPreview appData={appData} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Your app will appear here</h3>
              <p className="text-gray-500 max-w-md">
                Describe your app idea in the chat, and our AI will build it in real-time. Watch as your app comes to life!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIBuilder;
