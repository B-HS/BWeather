import { describe, expect, test } from 'bun:test'
import app from '../../index'
import type { ApiResponse, Location } from '@model/types'

const baseUrl = 'http://localhost:3000'

interface GridCoordinates {
    gridX: number
    gridY: number
}

interface LatLonCoordinates {
    latitude: number
    longitude: number
}

describe('Locations API E2E', () => {
    describe('GET /api/locations', () => {
        test('returns all locations', async () => {
            const res = await app.fetch(new Request(baseUrl + '/api/locations'))
            const data = (await res.json()) as ApiResponse<Location[]>

            expect(data.success).toBe(true)
            if (data.success) {
                expect(data.data).toBeArray()
                expect(data.data.length).toBeGreaterThan(3000)
                expect(data.data[0]).toHaveProperty('code')
                expect(data.data[0]).toHaveProperty('level1')
                expect(data.data[0]).toHaveProperty('gridX')
                expect(data.data[0]).toHaveProperty('gridY')
            }
        })
    })

    describe('GET /api/locations/:keyword', () => {
        test('returns locations matching keyword', async () => {
            const keyword = encodeURIComponent('종로')
            const res = await app.fetch(new Request(baseUrl + '/api/locations/' + keyword))
            const data = (await res.json()) as ApiResponse<Location[]>

            expect(data.success).toBe(true)
            if (data.success) {
                expect(data.data).toBeArray()
                expect(data.data.length).toBeGreaterThan(0)
                expect(data.data[0].level2).toBe('종로구')
            }
        })

        test('returns empty array for no matches', async () => {
            const keyword = encodeURIComponent('존재하지않는지역')
            const res = await app.fetch(new Request(baseUrl + '/api/locations/' + keyword))
            const data = (await res.json()) as ApiResponse<Location[]>

            expect(data.success).toBe(true)
            if (data.success) {
                expect(data.data).toBeArray()
                expect(data.data.length).toBe(0)
            }
        })
    })

    describe('GET /api/locations/convert', () => {
        test('converts lat/lon to grid coordinates', async () => {
            const res = await app.fetch(new Request(baseUrl + '/api/locations/convert?lat=37.5665&lon=126.9780'))
            const data = (await res.json()) as ApiResponse<GridCoordinates>

            expect(data.success).toBe(true)
            if (data.success) {
                expect(data.data.gridX).toBe(60)
                expect(data.data.gridY).toBe(127)
            }
        })

        test('converts grid to lat/lon coordinates', async () => {
            const res = await app.fetch(new Request(baseUrl + '/api/locations/convert?gridX=60&gridY=127'))
            const data = (await res.json()) as ApiResponse<LatLonCoordinates>

            expect(data.success).toBe(true)
            if (data.success) {
                expect(data.data.latitude).toBeCloseTo(37.5, 0)
                expect(data.data.longitude).toBeCloseTo(127.0, 0)
            }
        })

        test('returns error for missing parameters', async () => {
            const res = await app.fetch(new Request(baseUrl + '/api/locations/convert'))
            const data = (await res.json()) as ApiResponse<GridCoordinates>

            expect(data.success).toBe(false)
            if (!data.success) {
                expect(data.error.code).toBe('MISSING_PARAMETERS')
            }
        })
    })
})
