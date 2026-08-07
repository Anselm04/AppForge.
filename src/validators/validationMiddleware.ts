/**
 * Validation Middleware
 * Generic middleware for validating Express requests with Zod
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

// Validation error response
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationErrorResponse {
  success: false;
  error: 'VALIDATION_ERROR';
  message: string;
  errors: ValidationError[];
}

// Parsed request data
export interface ParsedRequest {
  body?: any;
  query?: any;
  params?: any;
}

/**
 * Format Zod errors into friendly validation errors
 */
export function formatZodError(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate request body
 */
export function validateBody<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors,
      } as ValidationErrorResponse);
    }
    
    // Overwrite body with parsed data (includes transformations)
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        errors,
      } as ValidationErrorResponse);
    }
    
    req.query = result.data;
    next();
  };
}

/**
 * Validate route parameters
 */
export function validateParams<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid route parameters',
        errors,
      } as ValidationErrorResponse);
    }
    
    req.params = result.data;
    next();
  };
}

/**
 * Validate multiple parts of request at once
 */
export function validateRequest<
  BodySchema extends ZodSchema,
  QuerySchema extends ZodSchema,
  ParamsSchema extends ZodSchema
>(schemas: {
  body?: BodySchema;
  query?: QuerySchema;
  params?: ParamsSchema;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    // Validate body
    if (schemas.body) {
      const bodyResult = schemas.body.safeParse(req.body);
      if (!bodyResult.success) {
        errors.push(...formatZodError(bodyResult.error));
      } else {
        req.body = bodyResult.data;
      }
    }
    
    // Validate query
    if (schemas.query) {
      const queryResult = schemas.query.safeParse(req.query);
      if (!queryResult.success) {
        errors.push(...formatZodError(queryResult.error));
      } else {
        req.query = queryResult.data;
      }
    }
    
    // Validate params
    if (schemas.params) {
      const paramsResult = schemas.params.safeParse(req.params);
      if (!paramsResult.success) {
        errors.push(...formatZodError(paramsResult.error));
      } else {
        req.params = paramsResult.data;
      }
    }
    
    // Return errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
      } as ValidationErrorResponse);
    }
    
    next();
  };
}

/**
 * Validate request headers
 */
export function validateHeaders<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.headers);
    
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid headers',
        errors,
      } as ValidationErrorResponse);
    }
    
    next();
  };
}

/**
 * Create a validated request handler with typed input
 */
export type ValidatedRequest<
  Body = {},
  Query = {},
  Params = {}
> = Request<Params, any, Body, Query>;

export type ValidatedHandler<
  Body = {},
  Query = {},
  Params = {}
> = (
  req: ValidatedRequest<Body, Query, Params>,
  res: Response,
  next: NextFunction
) => void;

export default {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  validateHeaders,
  formatZodError,
};
