import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { SQL } from 'bun'

const testDb = {
    db: null as SQL | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'test_%'`)
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('auth-service integration', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('register', () => {
        const { register } = require('@services/auth.service')

        test('creates a new user with valid credentials', async () => {
            const username = `test_user_${Date.now()}`
            const password = 'testPassword123'

            const result = await register(username, password)

            expect(result.user).toBeDefined()
            expect(result.user.username).toBe(username)
            expect(result.apitoken).toBeDefined()
            expect(result.apitoken).toHaveLength(64)
        })

        test('throws error for duplicate username', async () => {
            const username = `test_duplicate_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)

            expect(register(username, password)).rejects.toThrow('Username already exists')
        })

        test('throws error for short username', async () => {
            expect(register('ab', 'testPassword123')).rejects.toThrow('Username must be 3-50 characters')
        })

        test('throws error for short password', async () => {
            const username = `test_shortpw_${Date.now()}`
            expect(register(username, 'short')).rejects.toThrow('Password must be at least 8 characters')
        })

        test('throws error for invalid username characters', async () => {
            expect(register('test@user', 'testPassword123')).rejects.toThrow(
                'Username can only contain letters, numbers, and underscores'
            )
        })
    })

    describe('login', () => {
        const { register, login } = require('@services/auth.service')

        test('returns user and authtoken for valid credentials', async () => {
            const username = `test_login_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)
            const result = await login(username, password)

            expect(result.user).toBeDefined()
            expect(result.user.username).toBe(username)
            expect(result.authtoken).toBeDefined()
            expect(result.authtoken).toHaveLength(64)
            expect(result.expiresAt).toBeInstanceOf(Date)
        })

        test('throws error for invalid username', async () => {
            expect(login('nonexistent_user', 'testPassword123')).rejects.toThrow('Invalid username or password')
        })

        test('throws error for invalid password', async () => {
            const username = `test_wrongpw_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)

            expect(login(username, 'wrongPassword')).rejects.toThrow('Invalid username or password')
        })
    })

    describe('account locking', () => {
        const { register, login } = require('@services/auth.service')

        test('locks account after 5 failed attempts', async () => {
            const username = `test_lock_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)

            for (let i = 0; i < 5; i++) {
                try {
                    await login(username, 'wrongPassword')
                } catch {
                    // Expected to fail
                }
            }

            expect(login(username, password)).rejects.toThrow(/Account locked/)
        })
    })

    describe('validateApiToken', () => {
        const { register, validateApiToken } = require('@services/auth.service')

        test('returns user for valid apitoken', async () => {
            const username = `test_apitoken_${Date.now()}`
            const password = 'testPassword123'

            const { apitoken } = await register(username, password)
            const user = await validateApiToken(apitoken)

            expect(user).toBeDefined()
            expect(user?.username).toBe(username)
        })

        test('returns null for invalid apitoken', async () => {
            const user = await validateApiToken('invalid_token_12345')
            expect(user).toBeNull()
        })

        test('returns null for empty apitoken', async () => {
            const user = await validateApiToken('')
            expect(user).toBeNull()
        })
    })

    describe('validateSession', () => {
        const { register, login, validateSession, logout } = require('@services/auth.service')

        test('returns user for valid session', async () => {
            const username = `test_session_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)
            const { authtoken } = await login(username, password)
            const user = await validateSession(authtoken)

            expect(user).toBeDefined()
            expect(user?.username).toBe(username)
        })

        test('returns null after logout', async () => {
            const username = `test_logout_${Date.now()}`
            const password = 'testPassword123'

            await register(username, password)
            const { authtoken, user } = await login(username, password)

            await logout(user.userid)
            const sessionUser = await validateSession(authtoken)

            expect(sessionUser).toBeNull()
        })

        test('returns null for invalid session token', async () => {
            const user = await validateSession('invalid_session_token')
            expect(user).toBeNull()
        })
    })
})
