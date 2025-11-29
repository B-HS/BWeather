import type { Context, Next, ErrorHandler as HonoErrorHandler } from 'hono'
import type { ErrorResponse } from '@model/types'

export const errorHandler = async (c: Context, next: Next) => {
    try {
        await next()
    } catch (error) {
        console.error('Error:', error)

        const response: ErrorResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
        }

        return c.json(response, 500)
    }
}

export const onErrorHandler: HonoErrorHandler = (error, c) => {
    console.error('Error:', error)

    const response: ErrorResponse = {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
    }

    return c.json(response, 500)
}

export const notFoundHandler = (c: Context) => {
    const response: ErrorResponse = {
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${c.req.method} ${c.req.path} not found`,
        },
    }

    return c.json(response, 404)
}
