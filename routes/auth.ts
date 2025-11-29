import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { register, login, logout, validateSession } from '@services/auth.service'
import { registerSchema, loginSchema } from '@lib/validators'
import type { ErrorResponse } from '@model/types'

const auth = new Hono()

auth.post('/register', async (c) => {
    let body: unknown

    try {
        body = await c.req.json()
    } catch {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
            } as ErrorResponse,
            400
        )
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: firstIssue?.message || 'Validation failed',
                },
            } as ErrorResponse,
            400
        )
    }

    try {
        const result = await register(parsed.data.username, parsed.data.password)
        return c.json({
            success: true,
            data: {
                user: result.user,
                apitoken: result.apitoken,
            },
        })
    } catch (error) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'REGISTRATION_FAILED',
                    message: error instanceof Error ? error.message : 'Registration failed',
                },
            } as ErrorResponse,
            400
        )
    }
})

auth.post('/login', async (c) => {
    let body: unknown

    try {
        body = await c.req.json()
    } catch {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
            } as ErrorResponse,
            400
        )
    }

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: firstIssue?.message || 'Validation failed',
                },
            } as ErrorResponse,
            400
        )
    }

    try {
        const result = await login(parsed.data.username, parsed.data.password)

        setCookie(c, 'authtoken', result.authtoken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60 * 24 * 7,
        })

        return c.json({
            success: true,
            data: {
                user: result.user,
                expiresAt: result.expiresAt.toISOString(),
            },
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed'
        const isLocked = message.includes('locked')

        return c.json(
            {
                success: false,
                error: {
                    code: isLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
                    message,
                },
            } as ErrorResponse,
            isLocked ? 423 : 401
        )
    }
})

auth.post('/logout', async (c) => {
    const authtoken = getCookie(c, 'authtoken')

    if (authtoken) {
        const user = await validateSession(authtoken)
        if (user) {
            await logout(user.userid)
        }
    }

    deleteCookie(c, 'authtoken', { path: '/' })

    return c.json({
        success: true,
        data: { message: 'Logged out successfully' },
    })
})

export default auth
