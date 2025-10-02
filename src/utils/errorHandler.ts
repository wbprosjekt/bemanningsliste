// Error handler utilities - simplified to avoid TypeScript compilation issues

export const handleError = (error: unknown, context?: string) => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  return error;
};
