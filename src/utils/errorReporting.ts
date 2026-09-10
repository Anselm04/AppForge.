/**
 * Error Reporting Utilities
 */

import * as Sentry from "@sentry/node";
import { logger } from "../_core/logger.js";

const SENSITIVE_CONTEXT_KEY =
  /authorization|cookie|token|secret|password|passwd|api[-_]?key|session|credential|stripe[-_]?signature|email/i;
const MAX_CONTEXT_DEPTH = 6;

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > MAX_CONTEXT_DEPTH) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContext(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clean[key] = SENSITIVE_CONTEXT_KEY.test(key)
        ? "[REDACTED]"
        : sanitizeContext(item, depth + 1);
    }
    return clean;
  }
  return value;
}

export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND_ERROR",
  DATABASE = "DATABASE_ERROR",
  API = "API_ERROR",
  NETWORK = "NETWORK_ERROR",
  CONFIGURATION = "CONFIGURATION_ERROR",
  UNKNOWN = "UNKNOWN_ERROR",
}

export class AppError extends Error {
  type: ErrorType;
  statusCode: number;
  isOperational: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message, ErrorType.VALIDATION, 400);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, ErrorType.AUTHENTICATION, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, ErrorType.AUTHORIZATION, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, ErrorType.NOT_FOUND, 404);
  }
}

export class DatabaseError extends AppError {
  originalError?: unknown;
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorType.DATABASE, 500);
    this.originalError = originalError;
  }
}

export class APIError extends AppError {
  endpoint?: string;
  constructor(message: string, statusCode = 500, endpoint?: string) {
    super(message, ErrorType.API, statusCode);
    this.endpoint = endpoint;
  }
}

export function reportError(
  error: Error | AppError,
  context: Record<string, unknown> = {},
): string | undefined {
  if (context.userId) {
    Sentry.setUser({ id: String(context.userId) });
  }

  Sentry.setTag(
    "error_type",
    error instanceof AppError ? error.type : ErrorType.UNKNOWN,
  );
  if (context.action) Sentry.setTag("action", String(context.action));
  if (context.resource) Sentry.setTag("resource", String(context.resource));
  if (context.metadata) {
    Sentry.setExtra("metadata", sanitizeContext(context.metadata));
  }

  return Sentry.captureException(error);
}

export async function trackOperation<T>(
  operation: () => Promise<T>,
  context: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();

  try {
    const transaction = Sentry.startTransaction({
      op: "operation",
      name: String(context.name ?? "operation"),
    });
    if (context.userId) Sentry.setUser({ id: String(context.userId) });
    if (context.metadata) {
      Sentry.setExtra("metadata", sanitizeContext(context.metadata));
    }

    const result = await operation();
    transaction.finish();
    return result;
  } catch (error) {
    reportError(error as Error, {
      userId: context.userId,
      action: context.name,
      metadata: context.metadata,
    });
    throw error;
  } finally {
    const duration = Date.now() - start;
    Sentry.metrics.distribution("operation.duration", duration, {
      unit: "millisecond",
      tags: { operation: String(context.name ?? "operation") },
    });
  }
}

export function logError(error: Error, context?: string): void {
  logger.error({ error, context: context ?? "AppError" }, "application_error");
}

export function isOperationalError(error: Error): boolean {
  return error instanceof AppError && error.isOperational;
}

export function createErrorResponse(
  error: Error | AppError,
  includeStack = false,
) {
  const response: Record<string, unknown> = {
    error: error.message,
    statusCode: error instanceof AppError ? error.statusCode : 500,
  };
  if (error instanceof AppError) response.type = error.type;
  if (includeStack && process.env.NODE_ENV === "development") {
    response.stack = error.stack;
  }
  return response;
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  APIError,
  reportError,
  trackOperation,
  logError,
  isOperationalError,
  createErrorResponse,
};
