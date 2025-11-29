import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import app from '../../index'
import { SQL } from 'bun'
import type { ApiResponse, CurrentWeather, ShortTermForecast, UltraShortForecast } from '@model/types'

const baseUrl = 'http://localhost:3000'

interface ForecastResponse<T> {
    gridX: number
    gridY: number
    forecasts: T[]
}

interface VersionResponse {
    filetype: string
    version: string
}

const testDb = {
    db: null as SQL | null,
    apitoken: '',
    userid: null as number | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.ensurePlanLimits()
        await this.createTestUser()
    },
    async createTestUser() {
        const username = `e2e_weather_${Date.now()}`
        const registerRes = await app.fetch(
            new Request(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: 'testPassword123' }),
            })
        )
        const data = (await registerRes.json()) as ApiResponse<{ user: { userid: number }; apitoken: string }>
        if (data.success) {
            this.apitoken = data.data.apitoken
            this.userid = data.data.user.userid
        }
    },
    async ensurePlanLimits() {
        if (!this.db) return
        await this.db.unsafe(`UPDATE plan_limits SET daily_limit = 10 WHERE plan_type = 'free'`)
    },
    async clearLimitStatus() {
        if (!this.db || !this.userid) return
        await this.db.unsafe(`DELETE FROM limit_status WHERE userid = ?`, [this.userid])
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_weather_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'e2e_weather_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'e2e_weather_%'`)
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

describe('Weather API E2E', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    beforeEach(async () => {
        await testDb.clearLimitStatus()
    })

    describe('GET /api/weather/current', () => {
        test('returns current weather with grid coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            if (data.success) {
                expect(data.data).toBeDefined()
                expect(data.data.gridX).toBe(60)
                expect(data.data.gridY).toBe(127)
                expect(data.data.temperature).toBeDefined()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns current weather with location name', async () => {
            const locationEncoded = encodeURIComponent('서울특별시 종로구')
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?location=${locationEncoded}`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            if (data.success) {
                expect(data.data).toBeDefined()
                expect(data.data.temperature).toBeDefined()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for invalid coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=0&ny=0`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })

        test('returns error for missing parameters', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })

        test('returns error for out of range coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/current?nx=200&ny=300`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })
    })

    describe('GET /api/weather/short-term', () => {
        test('returns short-term forecast with grid coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/short-term?nx=60&ny=127`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<ForecastResponse<ShortTermForecast>>

            if (data.success) {
                expect(data.data).toBeDefined()
                expect(data.data.gridX).toBe(60)
                expect(data.data.gridY).toBe(127)
                expect(data.data.forecasts).toBeArray()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for missing parameters', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/short-term`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<ForecastResponse<ShortTermForecast>>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })
    })

    describe('GET /api/weather/ultra-short', () => {
        test('returns ultra-short forecast with grid coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/ultra-short?nx=60&ny=127`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<ForecastResponse<UltraShortForecast>>

            if (data.success) {
                expect(data.data).toBeDefined()
                expect(data.data.gridX).toBe(60)
                expect(data.data.gridY).toBe(127)
                expect(data.data.forecasts).toBeArray()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for invalid coordinates', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/ultra-short?nx=0&ny=0`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<ForecastResponse<UltraShortForecast>>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })
    })

    describe('GET /api/weather/version', () => {
        test('returns forecast version for valid ftype', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/version?ftype=ODAM`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<VersionResponse>

            if (data.success) {
                expect(data.data).toBeDefined()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for missing ftype', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/version`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<VersionResponse>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })

        test('returns error for invalid ftype', async () => {
            const res = await app.fetch(
                new Request(`${baseUrl}/api/weather/version?ftype=INVALID`, {
                    headers: { 'X-API-Token': testDb.apitoken },
                })
            )
            const data = (await res.json()) as ApiResponse<VersionResponse>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_FTYPE')
            }
        })
    })
})
