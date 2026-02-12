import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { validateSession } from '../services/auth.service'
import type { ErrorResponse } from '../model/types'
import type { HonoVariables } from '../model/hono.types'

export const sessionAuth = async (c: Context<{ Variables: HonoVariables }>, next: Next) => {
    const authtoken = getCookie(c, 'authtoken')

    if (!authtoken) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required. Please login',
            },
        }
        return c.json(response, 401)
    }

    const user = await validateSession(authtoken)

    if (!user) {
        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'SESSION_EXPIRED',
                message: 'Session expired or invalid. Please login again',
            },
        }
        return c.json(response, 401)
    }

    c.set('user', user)

    await next()
}
