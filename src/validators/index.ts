/**
 * Validators Index
 * Central export for all validation schemas and middleware
 */

// Common schemas
export {
  emailSchema,
  passwordSchema,
  usernameSchema,
  uuidSchema,
  urlSchema,
  nameSchema,
  paginationSchema,
  searchSchema,
  booleanStringSchema,
  dateStringSchema,
  metadataSchema,
  statusEnum,
  fileSchema,
  commonSchemas,
} from './commonSchemas';

export type {
  Email,
  Password,
  Username,
  UUID,
  URL,
  Name,
  Pagination,
  Search,
  Status,
  File,
} from './commonSchemas';

// Validation middleware
export {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  validateHeaders,
  formatZodError,
} from './validationMiddleware';

export type {
  ValidationError,
  ValidationErrorResponse,
  ParsedRequest,
  ValidatedRequest,
  ValidatedHandler,
} from './validationMiddleware';

// API schemas
export {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateUserSchema,
  getUserSchema,
  deleteUserSchema,
  listUsersSchema,
  createAgentSchema,
  updateAgentSchema,
  getAgentSchema,
  deleteAgentSchema,
  listAgentsSchema,
  runAgentSchema,
  createProjectSchema,
  updateProjectSchema,
  getProjectSchema,
  deleteProjectSchema,
  listProjectsSchema,
  createTaskSchema,
  updateTaskSchema,
  getTaskSchema,
  deleteTaskSchema,
  listTasksSchema,
  apiSchemas,
} from './apiSchemas';

export type {
  RegisterInput,
  LoginInput,
  CreateAgentInput,
  CreateProjectInput,
  CreateTaskInput,
} from './apiSchemas';
