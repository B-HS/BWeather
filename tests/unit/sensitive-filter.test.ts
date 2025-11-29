import { describe, expect, test } from 'bun:test'
import { isSensitiveKey, filterSensitiveData } from '@lib/sensitive-filter'

describe('sensitive-filter', () => {
    describe('isSensitiveKey', () => {
        test('detects password variants', () => {
            expect(isSensitiveKey('password')).toBe(true)
            expect(isSensitiveKey('userPassword')).toBe(true)
            expect(isSensitiveKey('PASSWORD')).toBe(true)
            expect(isSensitiveKey('passwd')).toBe(true)
            expect(isSensitiveKey('pwd')).toBe(true)
        })

        test('detects token variants', () => {
            expect(isSensitiveKey('token')).toBe(true)
            expect(isSensitiveKey('apitoken')).toBe(true)
            expect(isSensitiveKey('api_token')).toBe(true)
            expect(isSensitiveKey('authtoken')).toBe(true)
            expect(isSensitiveKey('auth_token')).toBe(true)
            expect(isSensitiveKey('access_token')).toBe(true)
            expect(isSensitiveKey('refresh_token')).toBe(true)
        })

        test('detects other sensitive keys', () => {
            expect(isSensitiveKey('secret')).toBe(true)
            expect(isSensitiveKey('apikey')).toBe(true)
            expect(isSensitiveKey('api_key')).toBe(true)
            expect(isSensitiveKey('authorization')).toBe(true)
            expect(isSensitiveKey('credential')).toBe(true)
            expect(isSensitiveKey('private')).toBe(true)
        })

        test('returns false for non-sensitive keys', () => {
            expect(isSensitiveKey('username')).toBe(false)
            expect(isSensitiveKey('email')).toBe(false)
            expect(isSensitiveKey('name')).toBe(false)
            expect(isSensitiveKey('nx')).toBe(false)
            expect(isSensitiveKey('ny')).toBe(false)
            expect(isSensitiveKey('location')).toBe(false)
        })
    })

    describe('filterSensitiveData', () => {
        test('filters sensitive keys', () => {
            const input = {
                username: 'john',
                password: 'secret123',
                token: 'abc123',
                nx: '60',
                ny: '127',
            }

            const result = filterSensitiveData(input)

            expect(result?.username).toBe('john')
            expect(result?.password).toBe('[REDACTED]')
            expect(result?.token).toBe('[REDACTED]')
            expect(result?.nx).toBe('60')
            expect(result?.ny).toBe('127')
        })

        test('returns null for null input', () => {
            expect(filterSensitiveData(null)).toBeNull()
        })

        test('handles empty object', () => {
            const result = filterSensitiveData({})
            expect(result).toEqual({})
        })

        test('preserves all non-sensitive data', () => {
            const input = {
                lat: '37.5',
                lon: '127.0',
                location: 'Seoul',
            }

            const result = filterSensitiveData(input)

            expect(result).toEqual(input)
        })
    })
})
