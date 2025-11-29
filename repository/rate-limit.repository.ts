import { getDb } from '@lib/db'

export const addRecord = async (userid: number, endpoint: string) => {
    const db = getDb()
    await db.unsafe(
        `INSERT INTO limit_status (userid, endpoint) VALUES (?, ?)`,
        [userid, endpoint]
    )
}

export const countIn24Hours = async (userid: number): Promise<number> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT COUNT(*) as count FROM limit_status
        WHERE userid = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [userid]
    )
    return Number(result[0]?.count ?? 0)
}

export const getOldestRequestIn24Hours = async (userid: number): Promise<Date | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT MIN(created_at) as oldest FROM limit_status
        WHERE userid = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [userid]
    )
    if (!result[0]?.oldest) return null
    return new Date(result[0].oldest)
}

export const cleanupOldRecords = async () => {
    const db = getDb()
    await db.unsafe(
        `DELETE FROM limit_status WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        []
    )
}

export const tryConsumeQuota = async (
    userid: number,
    endpoint: string,
    limit: number,
    maxRetries = 3
): Promise<{ success: boolean; currentCount: number }> => {
    const db = getDb()

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await db.begin(async (tx) => {
                const countResult = await tx.unsafe(
                    `SELECT COUNT(*) as count FROM limit_status
                     WHERE userid = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
                     FOR UPDATE`,
                    [userid]
                )

                const currentCount = Number(countResult[0]?.count ?? 0)

                if (currentCount >= limit) {
                    return { success: false, currentCount }
                }

                await tx.unsafe(
                    `INSERT INTO limit_status (userid, endpoint) VALUES (?, ?)`,
                    [userid, endpoint]
                )

                return { success: true, currentCount: currentCount + 1 }
            })
        } catch (error) {
            const isDeadlock = error instanceof Error && 'errno' in error && (error as { errno: number }).errno === 1213
            if (!isDeadlock || attempt === maxRetries - 1) {
                throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)))
        }
    }

    throw new Error('Max retries exceeded')
}
