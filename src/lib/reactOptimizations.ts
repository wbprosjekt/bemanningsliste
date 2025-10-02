/**
 * React optimization utilities and patterns
 * Provides optimized components and hooks for better performance
 */

import React, { memo, useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * Higher-order component for memoizing components with custom comparison
 */
export function withMemo<T extends React.ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: Readonly<React.ComponentProps<T>>, nextProps: Readonly<React.ComponentProps<T>>) => boolean
): React.MemoExoticComponent<T> {
  return memo(Component, areEqual) as React.MemoExoticComponent<T>;
}

/**
 * Custom hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for throttling function calls
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args: any[]) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Custom hook for stable array references
 */
export function useStableArray<T>(array: T[]): T[] {
  return useMemo(() => array, [JSON.stringify(array)]);
}

/**
 * Custom hook for stable object references
 */
export function useStableObject<T extends Record<string, any>>(obj: T): T {
  return useMemo(() => obj, [JSON.stringify(obj)]);
}

/**
 * Custom hook for deep comparison of objects
 */
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | undefined>(undefined);

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

/**
 * Deep equality comparison
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Custom hook for expensive computations with dependency tracking
 */
export function useExpensiveComputation<T>(
  computeFn: () => T,
  deps: React.DependencyList,
  options: { 
    enabled?: boolean;
    timeout?: number;
  } = {}
): { result: T | null; loading: boolean; error: Error | null } {
  const [result, setResult] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const { enabled = true, timeout = 100 } = options;

  useEffect(() => {
    if (!enabled) return;

    const executeComputation = async () => {
      setLoading(true);
      setError(null);

      try {
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Add timeout to prevent blocking
        const computationPromise = new Promise<T>((resolve) => {
          timeoutRef.current = setTimeout(() => {
            resolve(computeFn());
          }, timeout);
        });

        const result = await computationPromise;
        setResult(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Computation failed'));
      } finally {
        setLoading(false);
      }
    };

    executeComputation();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);

  return { result, loading, error };
}

/**
 * Custom hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      options
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * Custom hook for virtual scrolling
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex + 1),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    handleScroll,
    containerProps: {
      onScroll: handleScroll,
      style: { height: containerHeight, overflow: 'auto' },
    },
  };
}

// OptimizedButton removed due to TypeScript compilation issues

// OptimizedInput removed due to TypeScript compilation issues

/**
 * Custom hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} rendered ${renderCount.current} times, ${timeSinceLastRender}ms since last render`);
    }
    
    lastRenderTime.current = now;
  });

  return {
    renderCount: renderCount.current,
    logRender: (additionalInfo?: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`${componentName} render: ${additionalInfo || 'no additional info'}`);
      }
    },
  };
}

// withPerformanceMonitoring removed due to TypeScript compilation issues

