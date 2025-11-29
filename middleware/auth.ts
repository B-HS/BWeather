import type { Context, Next } from 'hono'
import { validateApiToken } from '@services/auth.service'
import type { ErrorResponse } from '@model/types'

export const apiTokenAuth = async (c: Context, next: Next) => {
    const apitoken = c.req.header('X-API-Token')

    if (!apitoken) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'API token required. Provide X-API-Token header',
            },
        }
        return c.json(response, 401)
    }

    const user = await validateApiToken(apitoken)

    if (!user) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid API token',
            },
        }
        return c.json(response, 401)
    }

    c.set('user', user)
    c.set('apitoken', apitoken)

    await next()
}
