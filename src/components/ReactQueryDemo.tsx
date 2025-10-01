/**
 * DEMO: React Query vs Traditional Approach
 * 
 * This file demonstrates the difference between the old approach
 * and the new React Query approach side-by-side.
 * 
 * This is for educational purposes - NOT used in production code.
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useEmployees } from '@/hooks/useStaffingData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DemoProps {
  orgId: string;
}

/**
 * OLD WAY: Manual state management
 */
export function EmployeeListOldWay({ orgId }: DemoProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const data = await fetch(`/api/employees?orgId=${orgId}`).then(r => r.json());
      setEmployees(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Manual loading state
  if (loading) return <div>Loading employees...</div>;
  
  // Manual error state
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          OLD WAY
          <Badge variant="destructive">Manual</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Found {employees.length} employees
          </p>
          <div className="text-xs font-mono bg-muted p-2 rounded">
            <div>✓ useState for data, loading, error</div>
            <div>✓ useCallback for load function</div>
            <div>✓ useEffect to trigger loading</div>
            <div>✓ Manual try/catch/finally</div>
            <div>✗ No caching</div>
            <div>✗ No auto-refetch</div>
            <div>✗ No retry on error</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * NEW WAY: React Query
 */
export function EmployeeListReactQuery({ orgId }: DemoProps) {
  // ONE LINE! 🎉
  const { data: employees, isLoading, error, isRefetching } = useEmployees(orgId);

  // Automatic loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Automatic error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          NEW WAY - React Query
          <Badge variant="default">Automatic</Badge>
          {isRefetching && <Badge variant="outline">Refreshing...</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Found {employees?.length || 0} employees
          </p>
          <div className="text-xs font-mono bg-muted p-2 rounded">
            <div>✅ ONE LINE: useEmployees(orgId)</div>
            <div>✅ Automatic loading/error states</div>
            <div>✅ Smart caching (5 min staleTime)</div>
            <div>✅ Auto-refetch on window focus</div>
            <div>✅ Auto-retry on error (3x)</div>
            <div>✅ Background refetching</div>
            <div>✅ Deduplication (multiple components = 1 request)</div>
          </div>
          
          {employees && employees.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium">Employees:</p>
              <ul className="text-xs space-y-1">
                {employees.slice(0, 3).map((emp: any) => (
                  <li key={emp.id}>
                    {emp.fornavn} {emp.etternavn}
                  </li>
                ))}
                {employees.length > 3 && (
                  <li className="text-muted-foreground">
                    ... and {employees.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Side-by-side comparison component
 */
export function ReactQueryComparison({ orgId }: DemoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      <div>
        <h3 className="text-lg font-bold mb-2">Before (Old Way)</h3>
        <div className="text-sm text-muted-foreground mb-4">
          ~50 lines of boilerplate code
        </div>
        {/* We won't actually render the old way to avoid duplicate API calls */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle>OLD WAY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono space-y-1">
              <div>const [data, setData] = useState([])</div>
              <div>const [loading, setLoading] = useState(false)</div>
              <div>const [error, setError] = useState(null)</div>
              <div>const loadData = useCallback(...)</div>
              <div>useEffect(() =&gt; loadData(), [loadData])</div>
              <div className="text-muted-foreground mt-2">+ 40 more lines...</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">After (React Query)</h3>
        <div className="text-sm text-green-600 mb-4">
          ✨ 1 line of code + automatic features
        </div>
        <EmployeeListReactQuery orgId={orgId} />
      </div>
    </div>
  );
}

