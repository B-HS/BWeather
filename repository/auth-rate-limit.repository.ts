import { getDb } from '@lib/db'

export const tryConsumeAuthQuota = async (
    ipAddress: string,
    endpoint: string,
    limit: number,
    windowMinutes: number
): Promise<{ success: boolean; remaining: number; resetAt: Date }> => {
    const db = getDb()

    return await db.begin(async (tx) => {
        const countResult = await tx.unsafe(
            `SELECT COUNT(*) as count FROM auth_rate_limit
             WHERE ip_address = ? AND endpoint = ?
             AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
             FOR UPDATE`,
            [ipAddress, endpoint, windowMinutes]
        )

        const currentCount = Number(countResult[0]?.count ?? 0)

        if (currentCount >= limit) {
            const oldestResult = await tx.unsafe(
                `SELECT MIN(created_at) as oldest FROM auth_rate_limit
                 WHERE ip_address = ? AND endpoint = ?
                 AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
                [ipAddress, endpoint, windowMinutes]
            )

            const resetAt = oldestResult[0]?.oldest
                ? new Date(new Date(oldestResult[0].oldest).getTime() + windowMinutes * 60 * 1000)
                : new Date(Date.now() + windowMinutes * 60 * 1000)

            return { success: false, remaining: 0, resetAt }
        }

        await tx.unsafe(
            `INSERT INTO auth_rate_limit (ip_address, endpoint) VALUES (?, ?)`,
            [ipAddress, endpoint]
        )

        return {
            success: true,
            remaining: limit - currentCount - 1,
            resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
        }
    })
}

export const cleanupOldAuthRecords = async (windowMinutes: number) => {
    const db = getDb()
    await db.unsafe(
        `DELETE FROM auth_rate_limit WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [windowMinutes]
    )
}
