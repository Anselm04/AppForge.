/**
 * API Schemas
 * Request/response schemas for AppForge API endpoints
 */

import { z } from 'zod';
import { emailSchema, passwordSchema, usernameSchema, uuidSchema, paginationSchema, searchSchema, nameSchema, statusEnum } from './commonSchemas';

// ==================== Auth Schemas ====================

export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    username: usernameSchema,
    name: nameSchema.optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
  body: z.object({
    password: passwordSchema,
  }),
});

export const verifyEmailSchema = z.object({
  params: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
});

// ==================== User Schemas ====================

export const updateUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
    name: nameSchema.optional(),
    status: statusEnum.optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const listUsersSchema = z.object({
  query: paginationSchema.merge(searchSchema),
});

// ==================== Agent Schemas ====================

export const createAgentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    type: z.enum(['workflow', 'task', 'pipeline']),
    config: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateAgentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    type: z.enum(['workflow', 'task', 'pipeline']).optional(),
    config: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const getAgentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const deleteAgentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const listAgentsSchema = z.object({
  query: paginationSchema.merge(searchSchema),
});

export const runAgentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    input: z.record(z.string(), z.any()).optional(),
    options: z.object({
      timeout: z.number().int().positive().optional(),
      retries: z.number().int().nonnegative().optional(),
    }).optional(),
  }),
});

// ==================== Project Schemas ====================

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    repository: z.string().url().optional(),
    framework: z.enum(['react', 'vue', 'angular', 'svelte', 'next', 'nuxt']).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    repository: z.string().url().optional(),
    framework: z.enum(['react', 'vue', 'angular', 'svelte', 'next', 'nuxt']).optional(),
  }),
});

export const getProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const deleteProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const listProjectsSchema = z.object({
  query: paginationSchema.merge(searchSchema),
});

// ==================== Task Schemas ====================

export const createTaskSchema = z.object({
  body: z.object({
    projectId: uuidSchema,
    agentId: uuidSchema,
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    input: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  }),
});

export const getTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const deleteTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const listTasksSchema = z.object({
  query: paginationSchema
    .merge(searchSchema)
    .merge(z.object({
      projectId: uuidSchema.optional(),
      agentId: uuidSchema.optional(),
      status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
    })),
});

// ==================== Export all schemas ====================

export const apiSchemas = {
  // Auth
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  
  // User
  updateUser: updateUserSchema,
  getUser: getUserSchema,
  deleteUser: deleteUserSchema,
  listUsers: listUsersSchema,
  
  // Agent
  createAgent: createAgentSchema,
  updateAgent: updateAgentSchema,
  getAgent: getAgentSchema,
  deleteAgent: deleteAgentSchema,
  listAgents: listAgentsSchema,
  runAgent: runAgentSchema,
  
  // Project
  createProject: createProjectSchema,
  updateProject: updateProjectSchema,
  getProject: getProjectSchema,
  deleteProject: deleteProjectSchema,
  listProjects: listProjectsSchema,
  
  // Task
  createTask: createTaskSchema,
  updateTask: updateTaskSchema,
  getTask: getTaskSchema,
  deleteTask: deleteTaskSchema,
  listTasks: listTasksSchema,
};

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
