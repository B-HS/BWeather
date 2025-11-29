import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import app from '../../index'
import { SQL } from 'bun'
import type { ApiResponse } from '@model/types'

const baseUrl = 'http://localhost:3000'

const testDb = {
    db: null as SQL | null,
    testUsername: '',
    testPassword: 'testPassword123',
    apitoken: '',
    userid: null as number | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.createTestUser()
    },
    async createTestUser() {
        this.testUsername = `e2e_ratelimit_${Date.now()}`

        const registerRes = await app.fetch(
            new Request(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.testUsername, password: this.testPassword }),
            })
        )

        const registerData = (await registerRes.json()) as ApiResponse<{ user: { userid: number }; apitoken: string }>
        if (registerData.success) {
            this.apitoken = registerData.data.apitoken
            this.userid = registerData.data.user.userid
        }

        if (this.db && this.userid) {
            await this.db.unsafe(`UPDATE plan_limits SET daily_limit = 3 WHERE plan_type = 'free'`)
        }
    },
    async clearLimitStatus() {
        if (this.db && this.userid) {
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid = ?`, [this.userid])
        }
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_ratelimit_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_ratelimit_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'e2e_ratelimit_%'`)
            await this.db.unsafe(`DELETE FROM auth_rate_limit`)
            await this.db.unsafe(`UPDATE plan_limits SET daily_limit = 10 WHERE plan_type = 'free'`)
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('Rate Limiting E2E', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    beforeEach(async () => {
        await testDb.clearLimitStatus()
    })

    describe('Weather API with Rate Limiting', () => {
        test('returns rate limit headers', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: {
                        'X-API-Token': testDb.apitoken,
                    },
                })
            )

            expect(res.headers.get('X-RateLimit-Limit')).toBe('3')
            expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
            expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
        })

        test('decrements remaining count with each request', async () => {
            const res1 = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            const remaining1 = parseInt(res1.headers.get('X-RateLimit-Remaining') || '0', 10)

            const res2 = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            const remaining2 = parseInt(res2.headers.get('X-RateLimit-Remaining') || '0', 10)

            expect(remaining2).toBe(remaining1 - 1)
        })

        test('returns 429 when rate limit exceeded', async () => {
            for (let i = 0; i < 3; i++) {
                await app.fetch(
                    new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                        method: 'GET',
                        headers: { 'X-API-Token': testDb.apitoken },
                    })
                )
            }

            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.status).toBe(429)

            const data = (await res.json()) as ApiResponse<never>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
            }

            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
        })

        test('applies rate limit to all weather endpoints', async () => {
            await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            await app.fetch(
                new Request(`${baseUrl}/api/weather/ultra-short?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            await app.fetch(
                new Request(`${baseUrl}/api/weather/short-term?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.status).toBe(429)
        })
    })

    describe('API Token Authentication', () => {
        test('returns 401 without API token', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<never>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('UNAUTHORIZED')
                expect(data.error.message).toContain('API token required')
            }
        })

        test('returns 401 with invalid API token', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': 'invalid_token_12345' },
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<never>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('UNAUTHORIZED')
                expect(data.error.message).toContain('Invalid API token')
            }
        })

        test('accepts valid API token', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    method: 'GET',
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )

            expect(res.status).not.toBe(401)
        })
    })

    describe('Locations API (No Auth Required)', () => {
        test('allows access without API token', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/locations`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<unknown[]>
            expect(data.success).toBe(true)
        })

        test('location search works without auth', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/locations/${encodeURIComponent('서울')}`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(200)
        })
    })
})
