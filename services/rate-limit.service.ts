import {
    addRecord,
    countIn24Hours,
    getOldestRequestIn24Hours,
    tryConsumeQuota,
} from '../repository/rate-limit.repository'
import { getUserPlanLimit } from './auth.service'
import type { RateLimitResult, UserInternal } from '../model/auth.types'

const getRateLimitData = async (user: UserInternal) => {
    const [limit, currentCount, oldestRequest] = await Promise.all([
        getUserPlanLimit(user),
        countIn24Hours(user.userid),
        getOldestRequestIn24Hours(user.userid),
    ])

    const remaining = Math.max(0, limit - currentCount)
    const resetAt = oldestRequest
        ? new Date(oldestRequest.getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)

    return { limit, currentCount, remaining, resetAt }
}

export const checkRateLimit = async (
    user: UserInternal,
    endpoint: string
): Promise<RateLimitResult> => {
    const { limit, currentCount, remaining, resetAt } = await getRateLimitData(user)

    if (currentCount >= limit) {
        return { allowed: false, remaining: 0, limit, resetAt }
    }

    return { allowed: true, remaining, limit, resetAt }
}

export const recordRequest = async (
    userid: number,
    endpoint: string
): Promise<void> => {
    await addRecord(userid, endpoint)
}

export const getUsage = async (
    user: UserInternal
): Promise<{ used: number; limit: number; remaining: number; resetAt: Date }> => {
    const { limit, currentCount, remaining, resetAt } = await getRateLimitData(user)
    return { used: currentCount, limit, remaining, resetAt }
}

export const consumeRateLimit = async (
    user: UserInternal,
    endpoint: string
): Promise<RateLimitResult> => {
    const limit = await getUserPlanLimit(user)
    const result = await tryConsumeQuota(user.userid, endpoint, limit)

    const oldestRequest = await getOldestRequestIn24Hours(user.userid)
    const resetAt = oldestRequest
        ? new Date(oldestRequest.getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)

    return {
        allowed: result.success,
        remaining: Math.max(0, limit - result.currentCount),
        limit,
        resetAt,
    }
}
