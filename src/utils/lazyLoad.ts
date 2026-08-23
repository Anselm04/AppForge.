import { lazy, Suspense, ComponentType, createElement } from 'react';
import type { ComponentProps, ReactNode } from 'react';

interface LazyLoadOptions {
  fallback?: ReactNode;
  timeout?: number;
}

const defaultFallback = createElement(
  'div',
  { className: 'flex items-center justify-center min-h-[200px]' },
  createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' })
);

export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = lazy(importFunc);
  return function LazyLoadedComponent(props: ComponentProps<T>) {
    return createElement(Suspense, { fallback: options.fallback || defaultFallback }, createElement(LazyComponent, props));
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
