import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { SQL } from 'bun'
import { apiTokenAuth } from '@middleware/auth'
import { sessionAuth } from '@middleware/session'
import { rateLimiter } from '@middleware/rate-limiter'
import { onErrorHandler, notFoundHandler } from '@middleware/error-handler'

const testDb = {
    db: null as SQL | null,
    apitoken: '',
    authtoken: '',
    userid: null as number | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.createTestUser()
    },
    async createTestUser() {
        if (!this.db) return
        const username = `test_middleware_${Date.now()}`
        const apitoken = 'test_apitoken_' + Date.now()
        const authtoken = 'test_authtoken_' + Date.now()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await this.db.unsafe(
            `INSERT INTO users (username, password_hash, apitoken, authtoken, authtoken_expires_at, max_count, plan_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, 'hash', apitoken, authtoken, expiresAt.toISOString().slice(0, 19).replace('T', ' '), 5, 'free']
        )
        const result = await this.db.unsafe(`SELECT userid FROM users WHERE username = ?`, [username])
        this.userid = result[0]?.userid
        this.apitoken = apitoken
        this.authtoken = authtoken
    },
    async clearLimitStatus() {
        if (!this.db || !this.userid) return
        await this.db.unsafe(`DELETE FROM limit_status WHERE userid = ?`, [this.userid])
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_middleware_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_middleware_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'test_middleware_%'`)
            await this.db.unsafe(`DELETE FROM auth_rate_limit`)
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('Middleware Integration Tests', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('apiTokenAuth middleware', () => {
        const createApp = () => {
            const app = new Hono()
            app.use('/protected/*', apiTokenAuth)
            app.get('/protected/test', (c) => c.json({ success: true, data: 'protected' }))
            return app
        }

        test('returns 401 without API token', async () => {
            const app = createApp()
            const res = await app.fetch(new Request('http://localhost/protected/test'))

            expect(res.status).toBe(401)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.code).toBe('UNAUTHORIZED')
            expect(data.error.message).toContain('API token required')
        })

        test('returns 401 with invalid API token', async () => {
            const app = createApp()
            const res = await app.fetch(
                new Request('http://localhost/protected/test', {
                    headers: { 'X-API-Token': 'invalid_token' },
                })
            )

            expect(res.status).toBe(401)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.message).toContain('Invalid API token')
        })

        test('allows access with valid API token', async () => {
            const app = createApp()
            const res = await app.fetch(
                new Request('http://localhost/protected/test', {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.success).toBe(true)
        })
    })

    describe('sessionAuth middleware', () => {
        const createApp = () => {
            const app = new Hono()
            app.use('/user/*', sessionAuth)
            app.get('/user/test', (c) => c.json({ success: true, data: 'user data' }))
            return app
        }

        test('returns 401 without session cookie', async () => {
            const app = createApp()
            const res = await app.fetch(new Request('http://localhost/user/test'))

            expect(res.status).toBe(401)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.code).toBe('UNAUTHORIZED')
        })

        test('returns 401 with invalid session token', async () => {
            const app = createApp()
            const res = await app.fetch(
                new Request('http://localhost/user/test', {
                    headers: { Cookie: 'authtoken=invalid_session_token' },
                })
            )

            expect(res.status).toBe(401)
            const data = await res.json()
            expect(data.success).toBe(false)
        })

        test('allows access with valid session token', async () => {
            const app = createApp()
            const res = await app.fetch(
                new Request('http://localhost/user/test', {
                    headers: { Cookie: `authtoken=${testDb.authtoken}` },
                })
            )

            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.success).toBe(true)
        })
    })

    describe('rateLimiter middleware', () => {
        const createApp = () => {
            const app = new Hono()
            app.use('/limited/*', apiTokenAuth, rateLimiter)
            app.get('/limited/test', (c) => c.json({ success: true, data: 'ok' }))
            return app
        }

        test('sets rate limit headers', async () => {
            await testDb.clearLimitStatus()
            const app = createApp()
            const res = await app.fetch(
                new Request('http://localhost/limited/test', {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
            expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
            expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
        })

        test('returns 429 when rate limit exceeded', async () => {
            await testDb.clearLimitStatus()
            const app = createApp()

            for (let i = 0; i < 10; i++) {
                await app.fetch(
                    new Request('http://localhost/limited/test', {
                        headers: { 'X-API-Token': testDb.apitoken },
                    })
                )
            }

            const res = await app.fetch(
                new Request('http://localhost/limited/test', {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.status).toBe(429)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
        })
    })

    describe('onErrorHandler', () => {
        test('catches errors and returns 500', async () => {
            const app = new Hono()
            app.onError(onErrorHandler)
            app.get('/error', () => {
                throw new Error('Test error')
            })

            const res = await app.fetch(new Request('http://localhost/error'))

            expect(res.status).toBe(500)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.code).toBe('INTERNAL_ERROR')
        })
    })

    describe('notFoundHandler middleware', () => {
        test('returns 404 for unknown routes', async () => {
            const app = new Hono()
            app.notFound(notFoundHandler)

            const res = await app.fetch(new Request('http://localhost/unknown'))

            expect(res.status).toBe(404)
            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error.code).toBe('NOT_FOUND')
        })
    })
})
