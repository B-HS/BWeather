import { Hono } from 'hono'
import { getUsage } from '../services/rate-limit.service'
import { regenerateApiToken, changePassword } from '../services/auth.service'
import { getLogsByUser, getLogsCountByUser } from '../repository/api-log.repository'
import { findByUserId } from '../repository/user.repository'
import { changePasswordSchema, paginationSchema } from '../lib/validators'
import type { ErrorResponse } from '../model/types'
import type { HonoVariables } from '../model/hono.types'

const user = new Hono<{ Variables: HonoVariables }>()

user.get('/me', async (c) => {
    const currentUser = c.get('user')

    const userWithApiToken = await findByUserId(currentUser.userid)
    if (!userWithApiToken) {
        return c.json(
            {
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found' },
            } as ErrorResponse,
            404
        )
    }

    return c.json({
        success: true,
        data: {
            userid: userWithApiToken.userid,
            username: userWithApiToken.username,
            apitoken: userWithApiToken.apitoken,
            maxCount: userWithApiToken.maxCount,
            planType: userWithApiToken.planType,
            createdAt: userWithApiToken.createdAt.toISOString(),
        },
    })
})

user.get('/usage', async (c) => {
    const currentUser = c.get('user')

    const usage = await getUsage(currentUser)

    return c.json({
        success: true,
        data: {
            used: usage.used,
            limit: usage.limit,
            remaining: usage.remaining,
            resetAt: usage.resetAt.toISOString(),
        },
    })
})

user.get('/logs', async (c) => {
    const currentUser = c.get('user')
    const parsed = paginationSchema.safeParse({
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
    })

    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 }

    const [logs, total] = await Promise.all([
        getLogsByUser(currentUser.userid, limit, offset),
        getLogsCountByUser(currentUser.userid),
    ])

    return c.json({
        success: true,
        data: {
            logs: logs.map((log) => ({
                logid: log.logid,
                endpoint: log.endpoint,
                method: log.method,
                requestParams: log.requestParams,
                responseStatus: log.responseStatus,
                responseTimeMs: log.responseTimeMs,
                createdAt: log.createdAt.toISOString(),
            })),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + logs.length < total,
            },
        },
    })
})

user.post('/regenerate-token', async (c) => {
    const currentUser = c.get('user')

    const newToken = await regenerateApiToken(currentUser.userid)

    return c.json({
        success: true,
        data: { apitoken: newToken },
    })
})

user.post('/change-password', async (c) => {
    const currentUser = c.get('user')

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

    const parsed = changePasswordSchema.safeParse(body)
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
        await changePassword(currentUser, parsed.data.currentPassword, parsed.data.newPassword)
        return c.json({
            success: true,
            data: { message: 'Password changed successfully' },
        })
    } catch (error) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'PASSWORD_CHANGE_FAILED',
                    message: error instanceof Error ? error.message : 'Password change failed',
                },
            } as ErrorResponse,
            400
        )
    }
})

export default user
