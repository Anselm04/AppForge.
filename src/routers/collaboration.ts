import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById, getUserById } from "../db.js";
import {
  createCollaborationVersion,
  getCollaborationRoom,
  getCollaboratorRole,
  heartbeatCollaborationRoom,
  isWritableCollaborationRole,
  joinCollaborationRoom,
  leaveCollaborationRoom,
  listCollaborators,
  removeCollaborator,
  upsertCollaborator,
  type CollaborationRole,
} from "../services/collaborationRuntime.js";

const projectIdSchema = z.number().int().positive();
const sessionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(96)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid collaboration session ID");
const cursorSchema = z
  .object({
    x: z.number().finite().min(-1_000_000).max(1_000_000),
    y: z.number().finite().min(-1_000_000).max(1_000_000),
    artifactId: z.string().trim().min(1).max(240).optional(),
  })
  .strict();
const metadataSchema = z
  .record(z.unknown())
  .refine(
    (value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 20_000,
    {
      message: "Version metadata is too large",
    },
  );

async function projectAccess(projectId: number, userId: number) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  if (project.userId === userId) {
    return { project, role: "owner" as const };
  }
  const role = await getCollaboratorRole(projectId, userId);
  if (!role) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return { project, role };
}

async function requireProjectOwner(projectId: number, userId: number) {
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}

function requireWritableRole(role: CollaborationRole | "owner") {
  if (!isWritableCollaborationRole(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This collaboration role is read-only",
    });
  }
}

export const collaborationRouter = router({
  room: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }))
    .query(async ({ ctx, input }) => {
      const access = await projectAccess(input.projectId, ctx.user.id);
      const room = await getCollaborationRoom(input.projectId);
      return { ...room, role: access.role };
    }),

  collaborators: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }))
    .query(async ({ ctx, input }) => {
      await requireProjectOwner(input.projectId, ctx.user.id);
      return listCollaborators(input.projectId);
    }),

  invite: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        userId: z.number().int().positive(),
        role: z.enum(["viewer", "editor"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectOwner(input.projectId, ctx.user.id);
      if (input.userId === project.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The project owner already has collaboration access",
        });
      }
      const collaborator = await getUserById(input.userId);
      if (!collaborator) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      await upsertCollaborator({
        projectId: input.projectId,
        userId: input.userId,
        invitedByUserId: ctx.user.id,
        role: input.role,
      });
      return { success: true as const };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        userId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(input.projectId, ctx.user.id);
      await removeCollaborator(input.projectId, input.userId);
      return { success: true as const };
    }),

  join: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        sessionId: sessionIdSchema,
        displayName: z.string().trim().min(1).max(160).optional(),
        cursor: cursorSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await projectAccess(input.projectId, ctx.user.id);
      await joinCollaborationRoom({
        projectId: input.projectId,
        userId: ctx.user.id,
        sessionId: input.sessionId,
        displayName: input.displayName ?? ctx.user.name ?? null,
        cursor: input.cursor ?? null,
      });
      return { success: true as const, role: access.role };
    }),

  heartbeat: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        sessionId: sessionIdSchema,
        cursor: cursorSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await projectAccess(input.projectId, ctx.user.id);
      await heartbeatCollaborationRoom({
        projectId: input.projectId,
        userId: ctx.user.id,
        sessionId: input.sessionId,
        cursor: input.cursor ?? null,
      });
      return { success: true as const };
    }),

  leave: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        sessionId: sessionIdSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await projectAccess(input.projectId, ctx.user.id);
      await leaveCollaborationRoom({
        projectId: input.projectId,
        userId: ctx.user.id,
        sessionId: input.sessionId,
      });
      return { success: true as const };
    }),

  createVersion: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        label: z.string().trim().min(1).max(160).optional(),
        metadata: metadataSchema.default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await projectAccess(input.projectId, ctx.user.id);
      requireWritableRole(access.role);
      const version = await createCollaborationVersion({
        projectId: input.projectId,
        userId: ctx.user.id,
        label: input.label ?? null,
        metadata: input.metadata,
      });
      return { success: true as const, version };
    }),
});
