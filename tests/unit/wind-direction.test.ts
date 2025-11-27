import { describe, expect, test } from 'bun:test'
import { getWindDirectionText } from '@lib/wind-direction'

describe('wind-direction', () => {
    describe('getWindDirectionText', () => {
        test('returns N for 0 degrees', () => {
            expect(getWindDirectionText(0)).toBe('N')
        })

        test('returns N for 360 degrees', () => {
            expect(getWindDirectionText(360)).toBe('N')
        })

        test('returns N for small angles', () => {
            expect(getWindDirectionText(5)).toBe('N')
            expect(getWindDirectionText(11)).toBe('N')
        })

        test('returns NNE for angles around 22.5', () => {
            expect(getWindDirectionText(22.5)).toBe('NNE')
            expect(getWindDirectionText(15)).toBe('NNE')
            expect(getWindDirectionText(30)).toBe('NNE')
        })

        test('returns NE for angles around 45', () => {
            expect(getWindDirectionText(45)).toBe('NE')
            expect(getWindDirectionText(40)).toBe('NE')
            expect(getWindDirectionText(50)).toBe('NE')
        })

        test('returns E for angles around 90', () => {
            expect(getWindDirectionText(90)).toBe('E')
            expect(getWindDirectionText(85)).toBe('E')
            expect(getWindDirectionText(95)).toBe('E')
        })

        test('returns S for angles around 180', () => {
            expect(getWindDirectionText(180)).toBe('S')
            expect(getWindDirectionText(175)).toBe('S')
            expect(getWindDirectionText(185)).toBe('S')
        })

        test('returns W for angles around 270', () => {
            expect(getWindDirectionText(270)).toBe('W')
            expect(getWindDirectionText(265)).toBe('W')
            expect(getWindDirectionText(275)).toBe('W')
        })

        test('returns NNW for angles around 337.5', () => {
            expect(getWindDirectionText(337.5)).toBe('NNW')
            expect(getWindDirectionText(340)).toBe('NNW')
        })

        test('returns N for angles near 360', () => {
            expect(getWindDirectionText(355)).toBe('N')
            expect(getWindDirectionText(350)).toBe('N')
        })
    })
})
