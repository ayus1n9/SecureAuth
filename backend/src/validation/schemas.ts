import { z } from 'zod';
import { Role } from '@prisma/client';

/**
 * Strict Password Policy:
 * - Minimum 12 characters, maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special symbol
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255, 'Email cannot exceed 255 characters')
      .transform((val) => val.trim().toLowerCase()),
    password: passwordSchema,
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters')
      .transform((val) => val.trim()),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address')
      .transform((val) => val.trim().toLowerCase()),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters')
      .transform((val) => val.trim())
      .optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
  })
  .strict();

export const uuidParamSchema = z
  .object({
    id: z.string().uuid('Invalid identifier format: must be a valid UUID'),
  })
  .strict();

export const createRecordSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title cannot exceed 200 characters')
      .transform((val) => val.trim()),
    content: z
      .string()
      .min(1, 'Content is required')
      .max(10000, 'Content cannot exceed 10,000 characters'),
    classification: z
      .enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'])
      .default('CONFIDENTIAL'),
  })
  .strict();

export const updateRecordSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters')
      .transform((val) => val.trim())
      .optional(),
    content: z
      .string()
      .min(1, 'Content cannot be empty')
      .max(10000, 'Content cannot exceed 10,000 characters')
      .optional(),
    classification: z
      .enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'])
      .optional(),
  })
  .strict();

export const changeRoleSchema = z
  .object({
    role: z.nativeEnum(Role, {
      errorMap: () => ({ message: 'Role must be one of: USER, SUPPORT, ADMIN' }),
    }),
  })
  .strict();

export const paginationQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
    search: z
      .string()
      .max(100)
      .optional()
      .transform((val) => (val ? val.trim() : undefined)),
  })
  .strict();
