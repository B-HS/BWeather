import { describe, expect, test } from 'bun:test'
import app from '../../index'
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

describe('Weather API E2E', () => {
    describe('GET /api/weather/current', () => {
        test('returns current weather with grid coordinates', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/current?nx=60&ny=127`))
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
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/current?location=${locationEncoded}`))
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            if (data.success) {
                expect(data.data).toBeDefined()
                expect(data.data.temperature).toBeDefined()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for invalid coordinates', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/current?nx=0&ny=0`))
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })

        test('returns error for missing parameters', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/current`))
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })

        test('returns error for out of range coordinates', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/current?nx=200&ny=300`))
            const data = (await res.json()) as ApiResponse<CurrentWeather>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })
    })

    describe('GET /api/weather/short-term', () => {
        test('returns short-term forecast with grid coordinates', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/short-term?nx=60&ny=127`))
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
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/short-term`))
            const data = (await res.json()) as ApiResponse<ForecastResponse<ShortTermForecast>>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })
    })

    describe('GET /api/weather/ultra-short', () => {
        test('returns ultra-short forecast with grid coordinates', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/ultra-short?nx=60&ny=127`))
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
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/ultra-short?nx=0&ny=0`))
            const data = (await res.json()) as ApiResponse<ForecastResponse<UltraShortForecast>>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_COORDINATES')
            }
        })
    })

    describe('GET /api/weather/version', () => {
        test('returns forecast version for valid ftype', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/version?ftype=ODAM`))
            const data = (await res.json()) as ApiResponse<VersionResponse>

            if (data.success) {
                expect(data.data).toBeDefined()
            } else {
                expect(data.error).toBeDefined()
            }
        })

        test('returns error for missing ftype', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/version`))
            const data = (await res.json()) as ApiResponse<VersionResponse>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })

        test('returns error for invalid ftype', async () => {
            const res = await app.fetch(new Request(`${baseUrl}/api/weather/version?ftype=INVALID`))
            const data = (await res.json()) as ApiResponse<VersionResponse>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('INVALID_FTYPE')
            }
        })
    })
})
