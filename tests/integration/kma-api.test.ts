import { describe, expect, test, beforeAll, mock } from 'bun:test'
import { getUltraSrtNcst, getUltraSrtFcst, getVilageFcst, getFcstVersion } from '@lib/kma-api'

describe('kma-api', () => {
    beforeAll(() => {
        process.env.KMA_API_KEY = process.env.KMA_API_KEY || 'test_key'
    })

    describe('getUltraSrtNcst', () => {
        test('fetches current weather data', async () => {
            const result = await getUltraSrtNcst(60, 127)
            if (result.success) {
                expect(result.data).toBeArray()
            } else {
                expect(result.error.code).toBeDefined()
            }
        })
    })

    describe('getUltraSrtFcst', () => {
        test('fetches ultra short forecast data', async () => {
            const result = await getUltraSrtFcst(60, 127)
            if (result.success) {
                expect(result.data).toBeArray()
            } else {
                expect(result.error.code).toBeDefined()
            }
        })
    })

    describe('getVilageFcst', () => {
        test('fetches short-term forecast data', async () => {
            const result = await getVilageFcst(60, 127)
            if (result.success) {
                expect(result.data).toBeArray()
            } else {
                expect(result.error.code).toBeDefined()
            }
        })
    })

    describe('getFcstVersion', () => {
        test('fetches forecast version', async () => {
            const result = await getFcstVersion('ODAM')
            if (result.success) {
                expect(result.data).toBeDefined()
            } else {
                expect(result.error.code).toBeDefined()
            }
        })
    })
})
