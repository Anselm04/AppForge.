import { lazy, Suspense, ComponentType } from 'react';

interface LazyLoadOptions {
  fallback?: React.ReactNode;
  timeout?: number;
}

const defaultFallback = (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = lazy(importFunc);
  
  return function LazyLoadedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={options.fallback || defaultFallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function lazyRoute<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  return lazyLoad(importFunc, options);
}

export function preloadComponent(importFunc: () => Promise<any>) {
  return () => importFunc();
}

export function preloadRoute(routes: string[]) {
  return () => {
    routes.forEach(route => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      document.head.appendChild(link);
    });
  };
}

export default lazyLoad;
