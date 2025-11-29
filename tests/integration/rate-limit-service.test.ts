import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import { SQL } from 'bun'

const testDb = {
    db: null as SQL | null,
    testUserId: null as number | null,
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.createTestUser()
    },
    async createTestUser() {
        if (!this.db) return
        const username = `test_ratelimit_${Date.now()}`
        const apitoken = 'test_apitoken_' + Date.now()
        await this.db.unsafe(
            `INSERT INTO users (username, password_hash, apitoken, max_count, plan_type) VALUES (?, ?, ?, ?, ?)`,
            [username, 'hash', apitoken, 10, 'free']
        )
        const result = await this.db.unsafe(`SELECT userid FROM users WHERE username = ?`, [username])
        this.testUserId = result[0]?.userid
    },
    async cleanupLimitStatus() {
        if (!this.db || !this.testUserId) return
        await this.db.unsafe(`DELETE FROM limit_status WHERE userid = ?`, [this.testUserId])
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM api_logs WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_ratelimit_%')`)
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_ratelimit_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'test_ratelimit_%'`)
        } catch {
            // Tables may not exist yet
        }
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('rate-limit-service integration', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    beforeEach(async () => {
        await testDb.cleanupLimitStatus()
    })

    describe('checkRateLimit', () => {
        test('allows request when under limit', async () => {
            const { checkRateLimit } = await import('@services/rate-limit.service')
            const { findByUserId } = await import('@repository/user.repository')

            const user = await findByUserId(testDb.testUserId!)
            if (!user) throw new Error('Test user not found')

            const result = await checkRateLimit(user, '/api/weather/current')

            expect(result.allowed).toBe(true)
            expect(result.remaining).toBe(10)
            expect(result.limit).toBe(10)
        })

        test('denies request when at limit', async () => {
            const { checkRateLimit, recordRequest } = await import('@services/rate-limit.service')
            const { findByUserId } = await import('@repository/user.repository')

            const user = await findByUserId(testDb.testUserId!)
            if (!user) throw new Error('Test user not found')

            for (let i = 0; i < 10; i++) {
                await recordRequest(user.userid, '/api/weather/current')
            }

            const result = await checkRateLimit(user, '/api/weather/current')

            expect(result.allowed).toBe(false)
            expect(result.remaining).toBe(0)
        })
    })

    describe('recordRequest', () => {
        test('increments request count', async () => {
            const { recordRequest, getUsage } = await import('@services/rate-limit.service')
            const { findByUserId } = await import('@repository/user.repository')

            const user = await findByUserId(testDb.testUserId!)
            if (!user) throw new Error('Test user not found')

            const beforeUsage = await getUsage(user)
            await recordRequest(user.userid, '/api/weather/current')
            const afterUsage = await getUsage(user)

            expect(afterUsage.used).toBe(beforeUsage.used + 1)
        })
    })

    describe('getUsage', () => {
        test('returns correct usage statistics', async () => {
            const { recordRequest, getUsage } = await import('@services/rate-limit.service')
            const { findByUserId } = await import('@repository/user.repository')

            const user = await findByUserId(testDb.testUserId!)
            if (!user) throw new Error('Test user not found')

            await recordRequest(user.userid, '/api/weather/current')
            await recordRequest(user.userid, '/api/weather/short-term')
            await recordRequest(user.userid, '/api/weather/ultra-short')

            const usage = await getUsage(user)

            expect(usage.used).toBe(3)
            expect(usage.limit).toBe(10)
            expect(usage.remaining).toBe(7)
            expect(usage.resetAt).toBeInstanceOf(Date)
        })

        test('returns zero usage for new user', async () => {
            const { getUsage } = await import('@services/rate-limit.service')
            const { findByUserId } = await import('@repository/user.repository')

            const user = await findByUserId(testDb.testUserId!)
            if (!user) throw new Error('Test user not found')

            const usage = await getUsage(user)

            expect(usage.used).toBe(0)
            expect(usage.remaining).toBe(10)
        })
    })
})
