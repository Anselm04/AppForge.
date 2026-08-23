import { categories, useCases } from '../data/templates';

interface TemplateFiltersProps {
  selectedCategory: string;
  selectedUseCase: string;
  searchQuery: string;
  onCategoryChange: (category: string) => void;
  onUseCaseChange: (useCase: string) => void;
  onSearchChange: (query: string) => void;
}

export function TemplateFilters({
  selectedCategory,
  selectedUseCase,
  searchQuery,
  onCategoryChange,
  onUseCaseChange,
  onSearchChange,
}: TemplateFiltersProps) {
  return (
    <div className="mb-8 space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search templates..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Use Case Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Use Case
          </label>
          <select
            value={selectedUseCase}
            onChange={(e) => onUseCaseChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Use Cases</option>
            {useCases.map((useCase) => (
              <option key={useCase.id} value={useCase.id}>
                {useCase.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters */}
      {(selectedCategory !== 'all' || selectedUseCase !== 'all' || searchQuery) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {selectedCategory !== 'all' && (
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
              {categories.find(c => c.id === selectedCategory)?.name}
            </span>
          )}
          {selectedUseCase !== 'all' && (
            <span className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full">
              {useCases.find(u => u.id === selectedUseCase)?.name}
            </span>
          )}
          {searchQuery && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
              "{searchQuery}"
            </span>
          )}
          <button
            onClick={() => {
              onCategoryChange('all');
              onUseCaseChange('all');
              onSearchChange('');
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default TemplateFilters;
