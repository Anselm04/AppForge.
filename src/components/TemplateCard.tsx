interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    description: string;
    category: string;
    useCases: string[];
    features: string[];
    techStack: string[];
  };
  onPreview: () => void;
  onUse: () => void;
}

export function TemplateCard({
  template,
  onPreview,
  onUse,
}: TemplateCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="absolute top-2 right-2 px-2 py-1 bg-white rounded-md text-xs font-medium text-gray-700">
          {template.category}
        </div>
        <p className="text-xs font-semibold uppercase text-gray-500">
          AppForge template
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {template.name}
        </h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-4">
          {template.features.slice(0, 3).map((feature, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {feature}
            </span>
          ))}
          {template.features.length > 3 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded-full">
              +{template.features.length - 3} more
            </span>
          )}
        </div>

        {/* Tech Stack */}
        <div className="flex flex-wrap gap-2 mb-4">
          {template.techStack.slice(0, 4).map((tech, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onPreview}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Details
          </button>
          <button
            onClick={onUse}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            🚀 Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateCard;
