import { describe, expect, test } from 'bun:test'
import { latLonToGrid, gridToLatLon } from '@lib/grid-converter'

describe('grid-converter', () => {
    describe('latLonToGrid', () => {
        test('converts Seoul coordinates correctly', () => {
            const result = latLonToGrid(37.5665, 126.978)
            expect(result.x).toBe(60)
            expect(result.y).toBe(127)
        })

        test('converts Busan coordinates correctly', () => {
            const result = latLonToGrid(35.1796, 129.0756)
            expect(result.x).toBe(98)
            expect(result.y).toBe(76)
        })

        test('converts Jeju coordinates correctly', () => {
            const result = latLonToGrid(33.4996, 126.5312)
            expect(result.x).toBe(53)
            expect(result.y).toBe(38)
        })
    })

    describe('gridToLatLon', () => {
        test('converts Seoul grid correctly', () => {
            const result = gridToLatLon(60, 127)
            expect(result.lat).toBeCloseTo(37.579, 1)
            expect(result.lon).toBeCloseTo(126.977, 1)
        })

        test('converts Busan grid correctly', () => {
            const result = gridToLatLon(98, 76)
            expect(result.lat).toBeCloseTo(35.18, 1)
            expect(result.lon).toBeCloseTo(129.08, 1)
        })
    })
})
