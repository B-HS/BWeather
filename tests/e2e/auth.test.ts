import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import app from '../../index'
import { SQL } from 'bun'
import type { ApiResponse } from '@model/types'

const baseUrl = 'http://localhost:3000'

interface RegisterResponse {
    user: {
        userid: number
        username: string
        maxCount: number
        planType: string
    }
    apitoken: string
}

interface LoginResponse {
    user: {
        userid: number
        username: string
    }
    expiresAt: string
}

const testDb = {
    db: null as SQL | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_auth_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_auth_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'e2e_auth_%'`)
            await this.db.unsafe(`DELETE FROM auth_rate_limit`)
        } catch {
            // Tables may not exist yet
        }
    },
    async clearAuthRateLimit() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM auth_rate_limit`)
        } catch {
            // Table may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('Auth API E2E', () => {
    beforeAll(async () => {
        await testDb.setup()
        await testDb.cleanup()
    })

    beforeEach(async () => {
        await testDb.clearAuthRateLimit()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('POST /api/auth/register', () => {
        test('registers a new user successfully', async () => {
            const username = `e2e_auth_${Date.now()}`
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: 'testPassword123' }),
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<RegisterResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.user.username).toBe(username)
                expect(data.data.apitoken).toHaveLength(64)
                expect(data.data.user.maxCount).toBe(10)
                expect(data.data.user.planType).toBe('free')
            }
        })

        test('returns error for duplicate username', async () => {
            const username = `e2e_auth_dup_${Date.now()}`

            await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: 'testPassword123' }),
                })
            )

            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: 'testPassword123' }),
                })
            )

            expect(res.status).toBe(400)

            const data = (await res.json()) as ApiResponse<RegisterResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('REGISTRATION_FAILED')
                expect(data.error.message).toContain('already exists')
            }
        })

        test('returns error for missing parameters', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'testuser' }),
                })
            )

            expect(res.status).toBe(400)

            const data = (await res.json()) as ApiResponse<RegisterResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('VALIDATION_ERROR')
            }
        })

        test('returns error for short password', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: `e2e_auth_short_${Date.now()}`, password: 'short' }),
                })
            )

            expect(res.status).toBe(400)

            const data = (await res.json()) as ApiResponse<RegisterResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.message).toContain('8 characters')
            }
        })
    })

    describe('POST /api/auth/login', () => {
        const testUsername = `e2e_auth_login_${Date.now()}`
        const testPassword = 'testPassword123'

        beforeAll(async () => {
            await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: testUsername, password: testPassword }),
                })
            )
        })

        test('logs in successfully with valid credentials', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: testUsername, password: testPassword }),
                })
            )

            expect(res.status).toBe(200)

            const setCookieHeader = res.headers.get('set-cookie')
            expect(setCookieHeader).toContain('authtoken=')
            expect(setCookieHeader).toContain('HttpOnly')

            const data = (await res.json()) as ApiResponse<LoginResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.user.username).toBe(testUsername)
                expect(data.data.expiresAt).toBeDefined()
            }
        })

        test('returns error for invalid password', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: testUsername, password: 'wrongPassword' }),
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<LoginResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('LOGIN_FAILED')
            }
        })

        test('returns error for non-existent user', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'nonexistent_user', password: 'testPassword123' }),
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<LoginResponse>
            expect(data.success).toBe(false)
        })
    })

    describe('POST /api/auth/logout', () => {
        test('logs out successfully', async () => {
            const username = `e2e_auth_logout_${Date.now()}`
            const password = 'testPassword123'

            await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                })
            )

            const loginRes = await app.fetch(
                new Request(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                })
            )

            const setCookie = loginRes.headers.get('set-cookie')
            const authtoken = setCookie?.match(/authtoken=([^;]+)/)?.[1]

            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `authtoken=${authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<{ message: string }>
            expect(data.success).toBe(true)
        })

        test('logout works even without cookie', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<{ message: string }>
            expect(data.success).toBe(true)
        })
    })

    describe('Account Locking', () => {
        test('locks account after 5 failed attempts', async () => {
            const username = `e2e_auth_lock_${Date.now()}`
            const password = 'testPassword123'

            await app.fetch(
                new Request(`${baseUrl}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                })
            )

            await testDb.clearAuthRateLimit()

            for (let i = 0; i < 5; i++) {
                await app.fetch(
                    new Request(`${baseUrl}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password: 'wrongPassword' }),
                    })
                )
            }

            await testDb.clearAuthRateLimit()

            const res = await app.fetch(
                new Request(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                })
            )

            expect(res.status).toBe(423)

            const data = (await res.json()) as ApiResponse<LoginResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('ACCOUNT_LOCKED')
            }
        })
    })
})
