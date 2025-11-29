import type { Context, Next } from 'hono'
import { tryConsumeAuthQuota } from '@repository/auth-rate-limit.repository'
import type { ErrorResponse } from '@model/types'

const AUTH_LIMITS: Record<string, { limit: number; windowMinutes: number }> = {
    '/api/auth/login': { limit: 5, windowMinutes: 15 },
    '/api/auth/register': { limit: 3, windowMinutes: 60 },
}

const DEFAULT_LIMIT = { limit: 10, windowMinutes: 15 }

export const authRateLimiter = async (c: Context, next: Next) => {
    const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        c.req.header('x-real-ip') ||
        'unknown'

    const endpoint = c.req.path
    const config = AUTH_LIMITS[endpoint] ?? DEFAULT_LIMIT

    const result = await tryConsumeAuthQuota(
        ipAddress,
        endpoint,
        config.limit,
        config.windowMinutes
    )

    c.header('X-RateLimit-Limit', String(config.limit))
    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', result.resetAt.toISOString())

    if (!result.success) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Too many attempts. Try again after ${result.resetAt.toISOString()}`,
            },
        }
        return c.json(response, 429)
    }

    await next()
}
