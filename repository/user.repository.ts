import { getDb } from '../lib/db'
import type { PlanLimit, PlanType, UserInternal } from '../model/auth.types'

export const createUser = async (
    username: string,
    passwordHash: string,
    apitoken: string
) => {
    const db = getDb()
    const result = await db.unsafe(
        `INSERT INTO users (username, password_hash, apitoken) VALUES (?, ?, ?)`,
        [username, passwordHash, apitoken]
    )
    return result
}

export const findByUsername = async (username: string): Promise<UserInternal | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT
            userid, username, password_hash, max_count, authtoken,
            authtoken_expires_at, apitoken, plan_type,
            failed_login_attempts, locked_until, created_at
        FROM users WHERE username = ?`,
        [username]
    )
    if (!result[0]) return null
    return mapToUserInternal(result[0])
}

export const findByApiToken = async (apitoken: string): Promise<UserInternal | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT
            userid, username, password_hash, max_count, authtoken,
            authtoken_expires_at, apitoken, plan_type,
            failed_login_attempts, locked_until, created_at
        FROM users WHERE apitoken = ?`,
        [apitoken]
    )
    if (!result[0]) return null
    return mapToUserInternal(result[0])
}

export const findByAuthToken = async (authtoken: string): Promise<UserInternal | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT
            userid, username, password_hash, max_count, authtoken,
            authtoken_expires_at, apitoken, plan_type,
            failed_login_attempts, locked_until, created_at
        FROM users WHERE authtoken = ?`,
        [authtoken]
    )
    if (!result[0]) return null
    return mapToUserInternal(result[0])
}

export const findByUserId = async (userid: number): Promise<UserInternal | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT
            userid, username, password_hash, max_count, authtoken,
            authtoken_expires_at, apitoken, plan_type,
            failed_login_attempts, locked_until, created_at
        FROM users WHERE userid = ?`,
        [userid]
    )
    if (!result[0]) return null
    return mapToUserInternal(result[0])
}

export const updateAuthToken = async (
    userid: number,
    authtoken: string,
    expiresAt: Date
) => {
    const db = getDb()
    await db.unsafe(
        `UPDATE users SET authtoken = ?, authtoken_expires_at = ?, failed_login_attempts = 0 WHERE userid = ?`,
        [authtoken, expiresAt.toISOString().slice(0, 19).replace('T', ' '), userid]
    )
}

export const clearAuthToken = async (userid: number) => {
    const db = getDb()
    await db.unsafe(
        `UPDATE users SET authtoken = NULL, authtoken_expires_at = NULL WHERE userid = ?`,
        [userid]
    )
}

export const incrementFailedAttempts = async (userid: number) => {
    const db = getDb()
    await db.unsafe(
        `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE userid = ?`,
        [userid]
    )
}

export const resetFailedAttempts = async (userid: number) => {
    const db = getDb()
    await db.unsafe(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE userid = ?`,
        [userid]
    )
}

export const lockAccount = async (userid: number, lockedUntil: Date) => {
    const db = getDb()
    await db.unsafe(
        `UPDATE users SET locked_until = ? WHERE userid = ?`,
        [lockedUntil.toISOString().slice(0, 19).replace('T', ' '), userid]
    )
}

export const updateApiToken = async (userid: number, apitoken: string) => {
    const db = getDb()
    await db.unsafe(`UPDATE users SET apitoken = ? WHERE userid = ?`, [apitoken, userid])
}

export const updatePasswordHash = async (userid: number, passwordHash: string) => {
    const db = getDb()
    await db.unsafe(`UPDATE users SET password_hash = ? WHERE userid = ?`, [passwordHash, userid])
}

export const getPlanLimit = async (planType: PlanType): Promise<PlanLimit | null> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT plan_type, daily_limit, description FROM plan_limits WHERE plan_type = ?`,
        [planType]
    )
    if (!result[0]) return null
    return {
        planType: result[0].plan_type,
        dailyLimit: result[0].daily_limit,
        description: result[0].description,
    }
}

const mapToUserInternal = (row: Record<string, unknown>): UserInternal => ({
    userid: row.userid as number,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    maxCount: row.max_count as number,
    authtoken: row.authtoken as string | null,
    authtokenExpiresAt: row.authtoken_expires_at ? new Date(row.authtoken_expires_at as string) : null,
    apitoken: row.apitoken as string,
    planType: row.plan_type as PlanType,
    failedLoginAttempts: row.failed_login_attempts as number,
    lockedUntil: row.locked_until ? new Date(row.locked_until as string) : null,
    createdAt: new Date(row.created_at as string),
})
