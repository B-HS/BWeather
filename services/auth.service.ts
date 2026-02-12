import { generateToken } from '../lib/token'
import { hashPassword, verifyPassword } from '../lib/password'
import {
    createUser,
    findByUsername,
    findByApiToken,
    findByAuthToken,
    updateAuthToken,
    clearAuthToken,
    incrementFailedAttempts,
    resetFailedAttempts,
    lockAccount,
    getPlanLimit,
    updateApiToken,
    updatePasswordHash,
} from '../repository/user.repository'
import type { User, UserInternal, AuthResponse, LoginResponse } from '../model/auth.types'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 30
const SESSION_DURATION_DAYS = 7

export const register = async (
    username: string,
    password: string
): Promise<AuthResponse> => {
    if (!username || username.length < 3 || username.length > 50) {
        throw new Error('Username must be 3-50 characters')
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores')
    }
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters')
    }
    if (password.length > 128) {
        throw new Error('Password too long')
    }

    const existingUser = await findByUsername(username)
    if (existingUser) {
        throw new Error('Username already exists')
    }

    const passwordHash = await hashPassword(password)
    const apitoken = generateToken()

    await createUser(username, passwordHash, apitoken)

    const user = await findByUsername(username)
    if (!user) {
        throw new Error('Failed to create user')
    }

    return {
        user: toPublicUser(user),
        apitoken,
    }
}

export const login = async (
    username: string,
    password: string
): Promise<{ user: User; authtoken: string; expiresAt: Date }> => {
    const user = await findByUsername(username)
    if (!user) {
        throw new Error('Invalid username or password')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil(
            (user.lockedUntil.getTime() - Date.now()) / 1000 / 60
        )
        throw new Error(`Account locked. Try again in ${remainingMinutes} minutes`)
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
        await incrementFailedAttempts(user.userid)

        if (user.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
            await lockAccount(user.userid, lockedUntil)
            throw new Error(`Account locked for ${LOCK_DURATION_MINUTES} minutes due to too many failed attempts`)
        }

        throw new Error('Invalid username or password')
    }

    await resetFailedAttempts(user.userid)

    const authtoken = generateToken()
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)
    await updateAuthToken(user.userid, authtoken, expiresAt)

    return {
        user: toPublicUser(user),
        authtoken,
        expiresAt,
    }
}

export const logout = async (userid: number): Promise<void> => {
    await clearAuthToken(userid)
}

export const validateApiToken = async (apitoken: string): Promise<UserInternal | null> => {
    if (!apitoken) return null
    return await findByApiToken(apitoken)
}

export const validateSession = async (authtoken: string): Promise<UserInternal | null> => {
    if (!authtoken) return null

    const user = await findByAuthToken(authtoken)
    if (!user) return null

    if (user.authtokenExpiresAt && user.authtokenExpiresAt < new Date()) {
        await clearAuthToken(user.userid)
        return null
    }

    return user
}

export const getUserPlanLimit = async (user: UserInternal): Promise<number> => {
    const planLimit = await getPlanLimit(user.planType)
    return planLimit?.dailyLimit ?? user.maxCount
}

export const regenerateApiToken = async (userid: number): Promise<string> => {
    const newToken = generateToken()
    await updateApiToken(userid, newToken)
    return newToken
}

export const changePassword = async (
    user: UserInternal,
    currentPassword: string,
    newPassword: string
): Promise<void> => {
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValidPassword) {
        throw new Error('Current password is incorrect')
    }

    if (!newPassword || newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters')
    }
    if (newPassword.length > 128) {
        throw new Error('New password too long')
    }

    const newPasswordHash = await hashPassword(newPassword)
    await updatePasswordHash(user.userid, newPasswordHash)
}

const toPublicUser = (user: UserInternal): User => ({
    userid: user.userid,
    username: user.username,
    maxCount: user.maxCount,
    planType: user.planType,
    createdAt: user.createdAt,
})
