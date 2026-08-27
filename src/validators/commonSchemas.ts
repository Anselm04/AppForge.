/**
 * Common Zod Schemas
 * Reusable validation schemas for AppForge
 */

import { z } from 'zod';

// Email validation
export const emailSchema = z.string().email('Invalid email address').min(1).max(255);

// Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Username validation (3-20 chars, alphanumeric + underscore)
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// URL validation (http/https only — Zod's .url() also accepts ftp:// etc.)
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .min(1)
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'URL must start with http:// or https://',
  });

// Name validation (first/last name)
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// Search schema
export const searchSchema = z.object({
  q: z.string().optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
  sortBy: z.string().optional(),
});

// Boolean string (for query params)
export const booleanStringSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true');

// Date string (ISO format)
export const dateStringSchema = z.string().datetime().optional();

// Metadata schema (key-value pairs)
export const metadataSchema = z.record(z.string(), z.any()).optional();

// Status enum
export const statusEnum = z.enum(['active', 'inactive', 'pending', 'archived']);

// File upload schema
export const fileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  size: z.number(),
  destination: z.string(),
  filename: z.string(),
  path: z.string(),
  buffer: z.instanceof(Buffer),
});

// Export common schemas
export const commonSchemas = {
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  uuid: uuidSchema,
  url: urlSchema,
  name: nameSchema,
  pagination: paginationSchema,
  search: searchSchema,
  boolean: booleanStringSchema,
  date: dateStringSchema,
  metadata: metadataSchema,
  status: statusEnum,
  file: fileSchema,
};

export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type Username = z.infer<typeof usernameSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type URL = z.infer<typeof urlSchema>;
export type Name = z.infer<typeof nameSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Search = z.infer<typeof searchSchema>;
export type Status = z.infer<typeof statusEnum>;
export type File = z.infer<typeof fileSchema>;
