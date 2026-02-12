import type { Context, Next } from 'hono'
import { createLog } from '../repository/api-log.repository'
import { filterSensitiveData } from '../lib/sensitive-filter'
import type { HonoVariables } from '../model/hono.types'

export const requestLogger = async (c: Context<{ Variables: HonoVariables }>, next: Next) => {
    const startTime = Date.now()
    const user = c.get('user')

    await next()

    const responseTime = Date.now() - startTime
    const status = c.res.status

    const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0] ||
        c.req.header('x-real-ip') ||
        null

    const queryParams: Record<string, string> = {}
    const url = new URL(c.req.url)
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value
    })

    const filteredParams = filterSensitiveData(
        Object.keys(queryParams).length > 0 ? queryParams : null
    )

    createLog({
        userid: user?.userid ?? null,
        endpoint: c.req.path,
        method: c.req.method,
        requestParams: filteredParams,
        responseStatus: status,
        responseTimeMs: responseTime,
        ipAddress,
    }).catch((error) => {
        console.error('Failed to log API request:', error)
    })
}
