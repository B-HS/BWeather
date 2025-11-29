import { describe, expect, test } from 'bun:test'
import { generateToken } from '@lib/token'

describe('token', () => {
    describe('generateToken', () => {
        test('generates a 64-character hex string', () => {
            const token = generateToken()

            expect(token).toHaveLength(64)
            expect(/^[a-f0-9]+$/.test(token)).toBe(true)
        })

        test('generates unique tokens each time', () => {
            const tokens = new Set<string>()

            for (let i = 0; i < 100; i++) {
                tokens.add(generateToken())
            }

            expect(tokens.size).toBe(100)
        })

        test('token contains only lowercase hex characters', () => {
            const token = generateToken()

            expect(/^[a-f0-9]+$/.test(token)).toBe(true)
            expect(/[A-F]/.test(token)).toBe(false)
        })
    })
})
