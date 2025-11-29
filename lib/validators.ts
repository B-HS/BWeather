import { z } from 'zod'

export const registerSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be at most 50 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters'),
})

export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'New password must be at least 8 characters')
        .max(128, 'New password must be at most 128 characters'),
})

export const coordinatesSchema = z.object({
    nx: z.coerce.number().int().min(1).max(149).optional(),
    ny: z.coerce.number().int().min(1).max(253).optional(),
    location: z.string().optional(),
}).refine((data) => (data.nx && data.ny) || data.location, {
    message: 'Either nx/ny or location is required',
})

export const paginationSchema = z.object({
    limit: z.coerce.number().int().default(20).transform((v) => Math.min(Math.max(v, 1), 100)),
    offset: z.coerce.number().int().default(0).transform((v) => Math.max(v, 0)),
})

export const ftypeSchema = z.enum(['ODAM', 'VSRT', 'SHRT'])

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CoordinatesInput = z.infer<typeof coordinatesSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
