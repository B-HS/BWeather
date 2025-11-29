import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import { SQL } from 'bun'
import {
    createUser,
    findByUsername,
    findByApiToken,
    findByAuthToken,
    findByUserId,
    updateAuthToken,
    clearAuthToken,
    incrementFailedAttempts,
    resetFailedAttempts,
    lockAccount,
    updateApiToken,
    updatePasswordHash,
    getPlanLimit,
} from '@repository/user.repository'

const testDb = {
    db: null as SQL | null,
    testUsername: '',
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_repo_%')`)
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_repo_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'test_repo_%'`)
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
    getUniqueUsername() {
        this.testUsername = `test_repo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        return this.testUsername
    },
}

describe('User Repository Tests', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    describe('createUser', () => {
        test('creates a new user successfully', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash123', 'apitoken123')

            const user = await findByUsername(username)
            expect(user).not.toBeNull()
            expect(user?.username).toBe(username)
            expect(user?.passwordHash).toBe('hash123')
            expect(user?.apitoken).toBe('apitoken123')
        })

        test('throws error for duplicate username', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'token1')

            await expect(createUser(username, 'hash', 'token2')).rejects.toThrow()
        })
    })

    describe('findByUsername', () => {
        test('returns user for existing username', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'testhash', 'testtoken')

            const user = await findByUsername(username)
            expect(user).not.toBeNull()
            expect(user?.username).toBe(username)
        })

        test('returns null for non-existent username', async () => {
            const user = await findByUsername('nonexistent_user_12345')
            expect(user).toBeNull()
        })
    })

    describe('findByApiToken', () => {
        test('returns user for valid API token', async () => {
            const username = testDb.getUniqueUsername()
            const apitoken = 'unique_apitoken_' + Date.now()
            await createUser(username, 'hash', apitoken)

            const user = await findByApiToken(apitoken)
            expect(user).not.toBeNull()
            expect(user?.apitoken).toBe(apitoken)
        })

        test('returns null for invalid API token', async () => {
            const user = await findByApiToken('invalid_token_12345')
            expect(user).toBeNull()
        })
    })

    describe('findByAuthToken', () => {
        test('returns user for valid auth token', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken')

            const user = await findByUsername(username)
            const authtoken = 'authtoken_' + Date.now()
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            await updateAuthToken(user!.userid, authtoken, expiresAt)

            const foundUser = await findByAuthToken(authtoken)
            expect(foundUser).not.toBeNull()
            expect(foundUser?.authtoken).toBe(authtoken)
        })

        test('returns null for invalid auth token', async () => {
            const user = await findByAuthToken('invalid_authtoken_12345')
            expect(user).toBeNull()
        })
    })

    describe('findByUserId', () => {
        test('returns user for valid user ID', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_findbyid_' + Date.now())

            const createdUser = await findByUsername(username)
            const user = await findByUserId(createdUser!.userid)

            expect(user).not.toBeNull()
            expect(user?.userid).toBe(createdUser!.userid)
        })

        test('returns null for invalid user ID', async () => {
            const user = await findByUserId(999999999)
            expect(user).toBeNull()
        })
    })

    describe('updateAuthToken', () => {
        test('updates auth token successfully', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_updateauth_' + Date.now())
            const user = await findByUsername(username)

            const authtoken = 'new_authtoken_' + Date.now()
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

            await updateAuthToken(user!.userid, authtoken, expiresAt)

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.authtoken).toBe(authtoken)
            expect(updatedUser?.authtokenExpiresAt).not.toBeNull()
        })
    })

    describe('clearAuthToken', () => {
        test('clears auth token successfully', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_clear_' + Date.now())
            const user = await findByUsername(username)

            await updateAuthToken(user!.userid, 'temptoken', new Date(Date.now() + 86400000))
            await clearAuthToken(user!.userid)

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.authtoken).toBeNull()
            expect(updatedUser?.authtokenExpiresAt).toBeNull()
        })
    })

    describe('incrementFailedAttempts', () => {
        test('increments failed attempts count', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_incr_' + Date.now())
            const user = await findByUsername(username)

            expect(user?.failedLoginAttempts).toBe(0)

            await incrementFailedAttempts(user!.userid)
            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.failedLoginAttempts).toBe(1)

            await incrementFailedAttempts(user!.userid)
            const updatedUser2 = await findByUserId(user!.userid)
            expect(updatedUser2?.failedLoginAttempts).toBe(2)
        })
    })

    describe('resetFailedAttempts', () => {
        test('resets failed attempts and locked_until', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_reset_' + Date.now())
            const user = await findByUsername(username)

            await incrementFailedAttempts(user!.userid)
            await incrementFailedAttempts(user!.userid)
            await lockAccount(user!.userid, new Date(Date.now() + 3600000))

            await resetFailedAttempts(user!.userid)

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.failedLoginAttempts).toBe(0)
            expect(updatedUser?.lockedUntil).toBeNull()
        })
    })

    describe('lockAccount', () => {
        test('locks account with specified time', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'apitoken_lock_' + Date.now())
            const user = await findByUsername(username)

            const lockedUntil = new Date(Date.now() + 3600000)
            await lockAccount(user!.userid, lockedUntil)

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.lockedUntil).not.toBeNull()
        })
    })

    describe('updateApiToken', () => {
        test('updates API token successfully', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'hash', 'old_apitoken_' + Date.now())
            const user = await findByUsername(username)

            const newToken = 'new_apitoken_' + Date.now()
            await updateApiToken(user!.userid, newToken)

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.apitoken).toBe(newToken)
        })
    })

    describe('updatePasswordHash', () => {
        test('updates password hash successfully', async () => {
            const username = testDb.getUniqueUsername()
            await createUser(username, 'old_hash', 'apitoken_pwd_' + Date.now())
            const user = await findByUsername(username)

            await updatePasswordHash(user!.userid, 'new_hash_value')

            const updatedUser = await findByUserId(user!.userid)
            expect(updatedUser?.passwordHash).toBe('new_hash_value')
        })
    })

    describe('getPlanLimit', () => {
        test('returns plan limit for free plan', async () => {
            const planLimit = await getPlanLimit('free')
            expect(planLimit).not.toBeNull()
            expect(planLimit?.planType).toBe('free')
            expect(planLimit?.dailyLimit).toBe(10)
        })

        test('returns plan limit for premium plan', async () => {
            const planLimit = await getPlanLimit('premium')
            expect(planLimit).not.toBeNull()
            expect(planLimit?.planType).toBe('premium')
            expect(planLimit?.dailyLimit).toBe(1000)
        })
    })
})
