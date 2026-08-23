/**
 * Error Reporting Utilities
 */

import * as Sentry from '@sentry/node';

export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  DATABASE = 'DATABASE_ERROR',
  API = 'API_ERROR',
  NETWORK = 'NETWORK_ERROR',
  CONFIGURATION = 'CONFIGURATION_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  type: ErrorType;
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  details?: any;
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION, 400);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, ErrorType.AUTHORIZATION, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ErrorType.NOT_FOUND, 404);
  }
}

export class DatabaseError extends AppError {
  originalError?: any;
  constructor(message: string, originalError?: any) {
    super(message, ErrorType.DATABASE, 500);
    this.originalError = originalError;
  }
}

export class APIError extends AppError {
  endpoint?: string;
  constructor(message: string, statusCode: number = 500, endpoint?: string) {
    super(message, ErrorType.API, statusCode);
    this.endpoint = endpoint;
  }
}

export function reportError(error: Error | AppError, context: any = {}): string | undefined {
  if (context.userId || context.userEmail) {
    Sentry.setUser({ id: context.userId, email: context.userEmail });
  }
  
  Sentry.setTag('error_type', error instanceof AppError ? error.type : ErrorType.UNKNOWN);
  if (context.action) Sentry.setTag('action', context.action);
  if (context.resource) Sentry.setTag('resource', context.resource);
  if (context.metadata) Sentry.setExtra('metadata', context.metadata);
  
  return Sentry.captureException(error);
}

export async function trackOperation<T>(operation: () => Promise<T>, context: any): Promise<T> {
  const start = Date.now();
  
  try {
    const transaction = Sentry.startTransaction({ op: 'operation', name: context.name });
    if (context.userId) Sentry.setUser({ id: context.userId });
    if (context.metadata) Sentry.setExtra('metadata', context.metadata);
    
    const result = await operation();
    transaction.finish();
    return result;
  } catch (error) {
    reportError(error as Error, { userId: context.userId, action: context.name, metadata: context.metadata });
    throw error;
  } finally {
    const duration = Date.now() - start;
    Sentry.metrics.distribution('operation.duration', duration, { unit: 'millisecond', operation: context.name });
  }
}

export function logError(error: Error, context?: string): void {
  console.error(`[${context || 'AppError'}] ${error.message}`);
  console.error(error.stack);
}

export function isOperationalError(error: Error): boolean {
  return error instanceof AppError && error.isOperational;
}

export function createErrorResponse(error: Error | AppError, includeStack: boolean = false) {
  const response: any = { error: error.message, statusCode: error instanceof AppError ? error.statusCode : 500 };
  if (error instanceof AppError) response.type = error.type;
  if (includeStack && process.env.NODE_ENV === 'development') response.stack = error.stack;
  return response;
}

export default { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, DatabaseError, APIError, reportError, trackOperation, logError, isOperationalError, createErrorResponse };
