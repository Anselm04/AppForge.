import { useState } from 'react';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateFilters } from '../components/TemplateFilters';
import { TemplatePreview } from '../components/TemplatePreview';
import { useTemplates } from '../hooks/useTemplates';

export function TemplateMarketplace() {
  const { templates, isLoading } = useTemplates();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedUseCase, setSelectedUseCase] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesUseCase = selectedUseCase === 'all' || template.useCases.includes(selectedUseCase);
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesUseCase && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📦 Template Marketplace</h1>
          <p className="text-gray-600">Browse production-ready app templates and launch in minutes</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <TemplateFilters
          selectedCategory={selectedCategory}
          selectedUseCase={selectedUseCase}
          searchQuery={searchQuery}
          onCategoryChange={setSelectedCategory}
          onUseCaseChange={setSelectedUseCase}
          onSearchChange={setSearchQuery}
        />

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={() => {
                  setSelectedTemplate(template);
                  setShowPreview(true);
                }}
                onUse={() => {
                  setSelectedTemplate(template);
                  setShowPreview(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your filters or search query</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedUseCase('all');
                setSearchQuery('');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

export default TemplateMarketplace;
