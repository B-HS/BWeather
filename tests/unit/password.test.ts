import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from '@lib/password'

describe('password', () => {
    describe('hashPassword', () => {
        test('generates a hash different from original password', async () => {
            const password = 'testPassword123'
            const hash = await hashPassword(password)

            expect(hash).not.toBe(password)
            expect(hash.length).toBeGreaterThan(0)
        })

        test('generates different hashes for same password', async () => {
            const password = 'testPassword123'
            const hash1 = await hashPassword(password)
            const hash2 = await hashPassword(password)

            expect(hash1).not.toBe(hash2)
        })

        test('hash contains argon2id identifier', async () => {
            const password = 'testPassword123'
            const hash = await hashPassword(password)

            expect(hash.startsWith('$argon2id$')).toBe(true)
        })
    })

    describe('verifyPassword', () => {
        test('returns true for correct password', async () => {
            const password = 'testPassword123'
            const hash = await hashPassword(password)
            const isValid = await verifyPassword(password, hash)

            expect(isValid).toBe(true)
        })

        test('returns false for incorrect password', async () => {
            const password = 'testPassword123'
            const wrongPassword = 'wrongPassword456'
            const hash = await hashPassword(password)
            const isValid = await verifyPassword(wrongPassword, hash)

            expect(isValid).toBe(false)
        })

        test('returns false for empty password', async () => {
            const password = 'testPassword123'
            const hash = await hashPassword(password)
            const isValid = await verifyPassword('', hash)

            expect(isValid).toBe(false)
        })

        test('handles special characters in password', async () => {
            const password = 'test@Pass#word$123!%^&*()'
            const hash = await hashPassword(password)
            const isValid = await verifyPassword(password, hash)

            expect(isValid).toBe(true)
        })

        test('handles unicode characters in password', async () => {
            const password = '비밀번호123テスト'
            const hash = await hashPassword(password)
            const isValid = await verifyPassword(password, hash)

            expect(isValid).toBe(true)
        })
    })
})
