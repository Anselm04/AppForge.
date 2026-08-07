import { useState, useEffect } from 'react';
import { templates } from '../data/templates';

export function useTemplates() {
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setTemplatesList(templates);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return {
    templates: templatesList,
    isLoading,
  };
}

export default useTemplates;
