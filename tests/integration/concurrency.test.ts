import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test'
import { SQL } from 'bun'
import { tryConsumeQuota, cleanupOldRecords } from '@repository/rate-limit.repository'
import { createUser, findByUsername } from '@repository/user.repository'

const testDb = {
    db: null as SQL | null,
    testUserId: 0,
    testUsername: '',
    async setup() {
        this.db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
        await this.cleanup()
        await this.createTestUser()
    },
    async createTestUser() {
        this.testUsername = `test_concurrency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await createUser(this.testUsername, 'hash', `apitoken_${Date.now()}`)
        const user = await findByUsername(this.testUsername)
        this.testUserId = user!.userid
    },
    async cleanup() {
        if (!this.db) return
        try {
            await this.db.unsafe(`DELETE FROM limit_status WHERE userid IN (SELECT userid FROM users WHERE username LIKE 'test_concurrency_%')`)
            await this.db.unsafe(`DELETE FROM users WHERE username LIKE 'test_concurrency_%'`)
        } catch {
            // Tables may not exist yet
        }
    },
    async clearLimitStatus() {
        if (!this.db) return
        await this.db.unsafe(`DELETE FROM limit_status WHERE userid = ?`, [this.testUserId])
    },
    async close() {
        await this.cleanup()
        if (this.db) await this.db.close()
    },
}

describe('Concurrency Tests', () => {
    beforeAll(async () => {
        await testDb.setup()
    })

    afterAll(async () => {
        await testDb.close()
    })

    beforeEach(async () => {
        await testDb.clearLimitStatus()
    })

    describe('tryConsumeQuota atomic operation', () => {
        test('correctly counts single request', async () => {
            const result = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', 10)

            expect(result.success).toBe(true)
            expect(result.currentCount).toBe(1)
        })

        test('correctly rejects when limit reached', async () => {
            const limit = 3

            for (let i = 0; i < limit; i++) {
                await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)
            }

            const result = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)

            expect(result.success).toBe(false)
            expect(result.currentCount).toBe(limit)
        })

        test('handles concurrent requests correctly', async () => {
            const limit = 5
            const concurrentRequests = 10

            const results = await Promise.all(
                Array(concurrentRequests)
                    .fill(null)
                    .map(() => tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit))
            )

            const successCount = results.filter((r) => r.success).length
            const failCount = results.filter((r) => !r.success).length

            expect(successCount).toBe(limit)
            expect(failCount).toBe(concurrentRequests - limit)
        })

        test('handles boundary condition (limit - 1, limit, limit + 1)', async () => {
            const limit = 3

            const result1 = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)
            const result2 = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)
            const result3 = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)
            const result4 = await tryConsumeQuota(testDb.testUserId, '/api/weather/current', limit)

            expect(result1.success).toBe(true)
            expect(result2.success).toBe(true)
            expect(result3.success).toBe(true)
            expect(result4.success).toBe(false)

            expect(result1.currentCount).toBe(1)
            expect(result2.currentCount).toBe(2)
            expect(result3.currentCount).toBe(3)
            expect(result4.currentCount).toBe(3)
        })
    })

    describe('cleanupOldRecords', () => {
        test('runs without error on empty table', async () => {
            await cleanupOldRecords()
        })
    })
})
