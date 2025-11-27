import { describe, expect, test } from 'bun:test'
import { getSkyText, getPtyText, getPtyTextShort, getRainfallText, getSnowfallText } from '@lib/weather-codes'

describe('weather-codes', () => {
    describe('getSkyText', () => {
        test('returns 맑음 for code 1', () => {
            expect(getSkyText(1)).toBe('맑음')
        })

        test('returns 구름많음 for code 3', () => {
            expect(getSkyText(3)).toBe('구름많음')
        })

        test('returns 흐림 for code 4', () => {
            expect(getSkyText(4)).toBe('흐림')
        })

        test('returns 알수없음 for unknown code', () => {
            expect(getSkyText(99)).toBe('알수없음')
        })
    })

    describe('getPtyText (초단기)', () => {
        test('returns 없음 for code 0', () => {
            expect(getPtyText(0)).toBe('없음')
        })

        test('returns 비 for code 1', () => {
            expect(getPtyText(1)).toBe('비')
        })

        test('returns 비/눈 for code 2', () => {
            expect(getPtyText(2)).toBe('비/눈')
        })

        test('returns 눈 for code 3', () => {
            expect(getPtyText(3)).toBe('눈')
        })

        test('returns 빗방울 for code 5', () => {
            expect(getPtyText(5)).toBe('빗방울')
        })

        test('returns 빗방울눈날림 for code 6', () => {
            expect(getPtyText(6)).toBe('빗방울눈날림')
        })

        test('returns 눈날림 for code 7', () => {
            expect(getPtyText(7)).toBe('눈날림')
        })
    })

    describe('getPtyTextShort (단기)', () => {
        test('returns 없음 for code 0', () => {
            expect(getPtyTextShort(0)).toBe('없음')
        })

        test('returns 비 for code 1', () => {
            expect(getPtyTextShort(1)).toBe('비')
        })

        test('returns 비/눈 for code 2', () => {
            expect(getPtyTextShort(2)).toBe('비/눈')
        })

        test('returns 눈 for code 3', () => {
            expect(getPtyTextShort(3)).toBe('눈')
        })

        test('returns 소나기 for code 4', () => {
            expect(getPtyTextShort(4)).toBe('소나기')
        })
    })

    describe('getRainfallText', () => {
        test('returns 강수없음 for empty string', () => {
            expect(getRainfallText('강수없음')).toBe('강수없음')
        })

        test('returns 1mm 미만 for value less than 1', () => {
            expect(getRainfallText('1mm 미만')).toBe('1mm 미만')
        })

        test('returns original value for other cases', () => {
            expect(getRainfallText('5~9mm')).toBe('5~9mm')
        })
    })

    describe('getSnowfallText', () => {
        test('returns 적설없음 for empty string', () => {
            expect(getSnowfallText('적설없음')).toBe('적설없음')
        })

        test('returns 1cm 미만 for value less than 1', () => {
            expect(getSnowfallText('1cm 미만')).toBe('1cm 미만')
        })

        test('returns original value for other cases', () => {
            expect(getSnowfallText('5~9cm')).toBe('5~9cm')
        })
    })
})
