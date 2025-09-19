import { toast } from '@/hooks/use-toast';
import { AppError } from '@/types';

export const handleError = (error: unknown, context?: string): AppError => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', error);
  }
  
  return new AppError('An unknown error occurred', 'UNKNOWN_ERROR', error);
};

export const showErrorToast = (error: AppError, title?: string) => {
  toast({
    title: title || 'En feil oppstod',
    description: error.message,
    variant: 'destructive'
  });
};

export const withErrorHandling = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = handleError(error, context);
      showErrorToast(appError);
      throw appError;
    }
  };
};

// Specific error handlers for common scenarios
export const handleSupabaseError = (error: any, operation: string): AppError => {
  if (error?.code === 'PGRST116') {
    return new AppError(`Ingen data funnet for ${operation}`, 'NO_DATA_FOUND');
  }
  
  if (error?.code === '23505') {
    return new AppError(`Data eksisterer allerede for ${operation}`, 'DUPLICATE_ENTRY');
  }
  
  if (error?.code === '23503') {
    return new AppError(`Referanse-feil for ${operation}`, 'REFERENCE_ERROR');
  }
  
  return new AppError(
    error?.message || `Feil ved ${operation}`,
    'SUPABASE_ERROR',
    error
  );
};

export const handleTripletexError = (error: any, operation: string): AppError => {
  if (error?.status === 401) {
    return new AppError('Ugyldige API-nøkler for Tripletex', 'INVALID_CREDENTIALS');
  }
  
  if (error?.status === 429) {
    return new AppError('For mange forespørsler til Tripletex', 'RATE_LIMITED');
  }
  
  if (error?.status >= 500) {
    return new AppError('Tripletex er midlertidig utilgjengelig', 'SERVICE_UNAVAILABLE');
  }
  
  return new AppError(
    error?.message || `Feil ved ${operation} med Tripletex`,
    'TRIPLETEX_ERROR',
    error
  );
};
