import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { SQL } from 'bun'
import {
    saveCurrentWeather,
    saveUltraForecasts,
    saveShortForecasts,
    getCurrentWeather,
    getUltraForecasts,
    getShortForecasts,
} from '@repository/weather.repository'

const testDb = {
    db: null as SQL | null,
    testGridX: 999,
    testGridY: 999,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM weather_current WHERE grid_x = ?`, [this.testGridX])
            await this.db.unsafe(`DELETE FROM weather_ultra WHERE grid_x = ?`, [this.testGridX])
            await this.db.unsafe(`DELETE FROM weather_short WHERE grid_x = ?`, [this.testGridX])
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('Weather Repository Tests', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('saveCurrentWeather', () => {
        test('saves new weather data', async () => {
            const data = {
                gridX: testDb.testGridX,
                gridY: testDb.testGridY,
                baseDate: '20241201',
                baseTime: '1200',
                temperature: 5.5,
                humidity: 60,
                rainfall: 0,
                windDirection: 180,
                windSpeed: 2.5,
                windU: 1.2,
                windV: -0.8,
            }

            await saveCurrentWeather(data)
            const result = await getCurrentWeather(data.gridX, data.gridY, data.baseDate, data.baseTime)

            expect(result).not.toBeNull()
            expect(Number(result.temperature)).toBe(5.5)
            expect(Number(result.humidity)).toBe(60)
        })

        test('updates existing weather data (UPSERT)', async () => {
            const data = {
                gridX: testDb.testGridX,
                gridY: testDb.testGridY,
                baseDate: '20241201',
                baseTime: '1300',
                temperature: 10.0,
                humidity: 50,
                rainfall: 0,
                windDirection: 90,
                windSpeed: 1.5,
                windU: 0.5,
                windV: 0.5,
            }

            await saveCurrentWeather(data)

            data.temperature = 12.5
            data.humidity = 55
            await saveCurrentWeather(data)

            const result = await getCurrentWeather(data.gridX, data.gridY, data.baseDate, data.baseTime)
            expect(Number(result.temperature)).toBe(12.5)
            expect(Number(result.humidity)).toBe(55)
        })
    })

    describe('getCurrentWeather', () => {
        test('returns null for non-existent data', async () => {
            const result = await getCurrentWeather(testDb.testGridX, testDb.testGridY, '19990101', '0000')
            expect(result).toBeNull()
        })
    })

    describe('saveUltraForecasts', () => {
        test('saves multiple forecasts', async () => {
            const forecasts = [
                {
                    fcstDate: '20241201',
                    fcstTime: '1400',
                    temperature: 8.0,
                    humidity: 55,
                    sky: 1,
                    pty: 0,
                    rainfall: 0,
                    lightning: 0,
                    windDirection: 270,
                    windSpeed: 3.0,
                },
                {
                    fcstDate: '20241201',
                    fcstTime: '1500',
                    temperature: 9.0,
                    humidity: 52,
                    sky: 3,
                    pty: 0,
                    rainfall: 0,
                    lightning: 0,
                    windDirection: 280,
                    windSpeed: 3.5,
                },
            ]

            await saveUltraForecasts(testDb.testGridX, testDb.testGridY, '20241201', '1300', forecasts)

            const results = await getUltraForecasts(testDb.testGridX, testDb.testGridY)
            expect(results.length).toBeGreaterThanOrEqual(2)
        })

        test('handles empty forecast array', async () => {
            await saveUltraForecasts(testDb.testGridX, testDb.testGridY, '20241201', '1400', [])
        })
    })

    describe('getUltraForecasts', () => {
        test('returns empty array for non-existent grid', async () => {
            const results = await getUltraForecasts(888, 888)
            expect(results.length).toBe(0)
        })

        test('returns forecasts sorted by date and time', async () => {
            const forecasts = [
                { fcstDate: '20241202', fcstTime: '0200', temperature: 5, humidity: 60, sky: 1, pty: 0, rainfall: 0, lightning: 0, windDirection: 0, windSpeed: 1 },
                { fcstDate: '20241202', fcstTime: '0100', temperature: 4, humidity: 65, sky: 1, pty: 0, rainfall: 0, lightning: 0, windDirection: 0, windSpeed: 1 },
            ]

            await saveUltraForecasts(testDb.testGridX, testDb.testGridY, '20241201', '2300', forecasts)
            const results = await getUltraForecasts(testDb.testGridX, testDb.testGridY)

            const filtered = results.filter((r: { fcst_date: string }) => r.fcst_date === '20241202')
            if (filtered.length >= 2) {
                expect(filtered[0].fcst_time <= filtered[1].fcst_time).toBe(true)
            }
        })
    })

    describe('saveShortForecasts', () => {
        test('saves forecasts with null values', async () => {
            const forecasts = [
                {
                    fcstDate: '20241203',
                    fcstTime: '0600',
                    temperature: null,
                    tempMin: -2.0,
                    tempMax: null,
                    humidity: 70,
                    sky: 4,
                    pty: 1,
                    pop: 80,
                    rainfall: '5mm',
                    snowfall: null,
                    windDirection: 45,
                    windSpeed: 4.0,
                },
            ]

            await saveShortForecasts(testDb.testGridX, testDb.testGridY, '20241203', '0200', forecasts)

            const results = await getShortForecasts(testDb.testGridX, testDb.testGridY)
            const found = results.find((r: { fcst_date: string; fcst_time: string }) => r.fcst_date === '20241203' && r.fcst_time === '0600')
            expect(found).not.toBeUndefined()
            expect(found.temperature).toBeNull()
            expect(Number(found.temp_min)).toBe(-2.0)
        })

        test('handles rainfall/snowfall string values', async () => {
            const forecasts = [
                {
                    fcstDate: '20241204',
                    fcstTime: '1200',
                    temperature: 0,
                    tempMin: null,
                    tempMax: null,
                    humidity: 80,
                    sky: 4,
                    pty: 3,
                    pop: 90,
                    rainfall: '10~20mm',
                    snowfall: '5cm',
                    windDirection: 0,
                    windSpeed: 5.0,
                },
            ]

            await saveShortForecasts(testDb.testGridX, testDb.testGridY, '20241204', '0500', forecasts)

            const results = await getShortForecasts(testDb.testGridX, testDb.testGridY)
            const found = results.find((r: { fcst_date: string; fcst_time: string }) => r.fcst_date === '20241204' && r.fcst_time === '1200')
            expect(found.rainfall).toBe('10~20mm')
            expect(found.snowfall).toBe('5cm')
        })
    })

    describe('getShortForecasts', () => {
        test('returns empty array for non-existent grid', async () => {
            const results = await getShortForecasts(777, 777)
            expect(results.length).toBe(0)
        })
    })
})
