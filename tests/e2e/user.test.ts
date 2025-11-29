import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import app from '../../index'
import { SQL } from 'bun'
import type { ApiResponse } from '@model/types'

const baseUrl = 'http://localhost:3000'

interface UserMeResponse {
    userid: number
    username: string
    apitoken: string
    maxCount: number
    planType: string
    createdAt: string
}

interface UsageResponse {
    used: number
    limit: number
    remaining: number
    resetAt: string
}

interface LogsResponse {
    logs: Array<{
        logid: number
        endpoint: string
        method: string
        responseStatus: number
        createdAt: string
    }>
    pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
    }
}

const testDb = {
    db: null as SQL | null,
    testUsername: '',
    testPassword: 'testPassword123',
    authtoken: '',
    apitoken: '',
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.createTestUser()
    },
    async createTestUser() {
        this.testUsername = `e2e_user_${Date.now()}`

        const registerRes = await app.fetch(
            new Request(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.testUsername, password: this.testPassword }),
            })
        )

        const registerData = (await registerRes.json()) as ApiResponse<{ apitoken: string }>
        if (registerData.success) {
            this.apitoken = registerData.data.apitoken
        }

        const loginRes = await app.fetch(
            new Request(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.testUsername, password: this.testPassword }),
            })
        )

        const setCookie = loginRes.headers.get('set-cookie')
        this.authtoken = setCookie?.match(/authtoken=([^;]+)/)?.[1] || ''
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_user_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_user_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'e2e_user_%'`)
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

describe('User API E2E', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('GET /api/user/me', () => {
        test('returns user info with valid session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/me`, {
                    method: 'GET',
                    headers: {
                        Cookie: `authtoken=${testDb.authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<UserMeResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.username).toBe(testDb.testUsername)
                expect(data.data.apitoken).toBe(testDb.apitoken)
                expect(data.data.maxCount).toBe(10)
                expect(data.data.planType).toBe('free')
            }
        })

        test('returns error without session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/me`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<UserMeResponse>
            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('UNAUTHORIZED')
            }
        })

        test('returns error with invalid session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/me`, {
                    method: 'GET',
                    headers: {
                        Cookie: 'authtoken=invalid_token',
                    },
                })
            )

            expect(res.status).toBe(401)

            const data = (await res.json()) as ApiResponse<UserMeResponse>
            expect(data.success).toBe(false)
        })
    })

    describe('GET /api/user/usage', () => {
        test('returns usage info with valid session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/usage`, {
                    method: 'GET',
                    headers: {
                        Cookie: `authtoken=${testDb.authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<UsageResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.limit).toBe(10)
                expect(data.data.used).toBeGreaterThanOrEqual(0)
                expect(data.data.remaining).toBeLessThanOrEqual(10)
                expect(data.data.resetAt).toBeDefined()
            }
        })

        test('returns error without session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/usage`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(401)
        })
    })

    describe('GET /api/user/logs', () => {
        beforeAll(async () => {
            for (let i = 0; i < 3; i++) {
                await app.fetch(
                    new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                        method: 'GET',
                        headers: {
                            'X-API-Token': testDb.apitoken,
                        },
                    })
                )
            }
            await new Promise((resolve) => setTimeout(resolve, 100))
        })

        test('returns logs with valid session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/logs`, {
                    method: 'GET',
                    headers: {
                        Cookie: `authtoken=${testDb.authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<LogsResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.logs).toBeArray()
                expect(data.data.pagination).toBeDefined()
                expect(data.data.pagination.limit).toBe(20)
                expect(data.data.pagination.offset).toBe(0)
            }
        })

        test('supports pagination parameters', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/logs?limit=5&offset=0`, {
                    method: 'GET',
                    headers: {
                        Cookie: `authtoken=${testDb.authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<LogsResponse>
            expect(data.success).toBe(true)

            if (data.success) {
                expect(data.data.pagination.limit).toBe(5)
            }
        })

        test('limits maximum page size to 100', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/logs?limit=200`, {
                    method: 'GET',
                    headers: {
                        Cookie: `authtoken=${testDb.authtoken}`,
                    },
                })
            )

            expect(res.status).toBe(200)

            const data = (await res.json()) as ApiResponse<LogsResponse>
            if (data.success) {
                expect(data.data.pagination.limit).toBe(100)
            }
        })

        test('returns error without session', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/user/logs`, {
                    method: 'GET',
                })
            )

            expect(res.status).toBe(401)
        })
    })
})
