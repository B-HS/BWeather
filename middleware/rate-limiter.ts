import type { Context, Next } from 'hono'
import { consumeRateLimit } from '../services/rate-limit.service'
import type { ErrorResponse } from '../model/types'
import type { HonoVariables } from '../model/hono.types'

export const rateLimiter = async (c: Context<{ Variables: HonoVariables }>, next: Next) => {
    const user = c.get('user')

    if (!user) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        }
        return c.json(response, 401)
    }

    const endpoint = c.req.path
    const result = await consumeRateLimit(user, endpoint)

    c.header('X-RateLimit-Limit', String(result.limit))
    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', result.resetAt.toISOString())

    if (!result.allowed) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Rate limit exceeded. Limit: ${result.limit} requests per 24 hours`,
            },
        }
        return c.json(response, 429)
    }

    await next()
}
