import { describe, expect, test, beforeEach } from 'bun:test'
import { WeatherCache } from '@lib/weather-cache'

describe('weather-cache', () => {
    let cache: WeatherCache

    beforeEach(() => {
        cache = new WeatherCache()
    })

    describe('memory cache', () => {
        test('stores and retrieves current weather', () => {
            const key = { type: 'current' as const, gridX: 60, gridY: 127, baseDate: '20241127', baseTime: '1200' }
            const data = { temperature: 10, humidity: 50 }

            cache.set(key, data, 60000)
            const result = cache.get(key)

            expect(result).toEqual(data)
        })

        test('returns null for expired entries', async () => {
            const key = { type: 'current' as const, gridX: 60, gridY: 127, baseDate: '20241127', baseTime: '1200' }
            const data = { temperature: 10 }

            cache.set(key, data, 1)
            await new Promise((resolve) => setTimeout(resolve, 10))
            const result = cache.get(key)

            expect(result).toBeNull()
        })

        test('returns null for non-existent keys', () => {
            const key = { type: 'current' as const, gridX: 99, gridY: 99, baseDate: '20241127', baseTime: '1200' }
            const result = cache.get(key)

            expect(result).toBeNull()
        })
    })

    describe('cache key generation', () => {
        test('generates unique keys for different parameters', () => {
            const key1 = { type: 'current' as const, gridX: 60, gridY: 127, baseDate: '20241127', baseTime: '1200' }
            const key2 = { type: 'current' as const, gridX: 60, gridY: 128, baseDate: '20241127', baseTime: '1200' }

            cache.set(key1, { temp: 10 }, 60000)
            cache.set(key2, { temp: 20 }, 60000)

            expect(cache.get<{ temp: number }>(key1)).toEqual({ temp: 10 })
            expect(cache.get<{ temp: number }>(key2)).toEqual({ temp: 20 })
        })
    })
})
