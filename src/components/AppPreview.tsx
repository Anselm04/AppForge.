import { useState } from 'react';

interface AppPreviewProps {
  appData: {
    name: string;
    description: string;
    previewUrl: string;
    deployUrl: string;
    features: string[];
    components: string[];
    status: 'building' | 'ready';
  };
}

export function AppPreview({ appData }: AppPreviewProps) {
  const [activeTab, setActiveTab] = useState('preview');

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'preview'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'features'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Features
        </button>
        <button
          onClick={() => setActiveTab('deploy')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'deploy'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Deploy
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'preview' && (
          <div className="h-full">
            {appData.status === 'building' ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Building your app...</h3>
                  <p className="text-gray-500">This may take a few minutes</p>
                  <div className="mt-4 space-y-2">
                    {appData.components.map((component, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                          {index < Math.floor(Date.now() / 1000) % appData.components.length ? '✓' : ''}
                        </div>
                        <span>{component}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                src={appData.previewUrl}
                className="w-full h-full border rounded-lg"
                title="App Preview"
              />
            )}
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">App Features</h3>
            <div className="grid gap-3">
              {appData.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-medium">
                    ✓
                  </div>
                  <p className="text-sm text-gray-700">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'deploy' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Deploy Your App</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your app is ready to deploy! Click the button below to deploy to production.
              </p>
            </div>

            <div className="space-y-4">
              <a
                href={appData.deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-6 py-3 bg-green-600 text-white text-center font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                🚀 Deploy to Vercel
              </a>
              
              <button className="block w-full px-6 py-3 bg-gray-800 text-white text-center font-medium rounded-lg hover:bg-gray-900 transition-colors">
                📦 Download Source Code
              </button>
              
              <button className="block w-full px-6 py-3 border border-gray-300 text-gray-700 text-center font-medium rounded-lg hover:bg-gray-50 transition-colors">
                🔄 Export to GitHub
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">What's Included:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Frontend (React + TypeScript + Tailwind)</li>
                <li>✓ Backend (Express + tRPC)</li>
                <li>✓ Database (PostgreSQL + Drizzle ORM)</li>
                <li>✓ Authentication (JWT)</li>
                <li>✓ Rate Limiting</li>
                <li>✓ Monitoring (Prometheus + Grafana)</li>
                <li>✓ CI/CD Pipeline (GitHub Actions)</li>
                <li>✓ Testing Suite (Vitest)</li>
                <li>✓ Automated Backups</li>
                <li>✓ Documentation (Docusaurus)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppPreview;
