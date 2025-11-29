export type PlanType = 'free' | 'basic' | 'premium' | 'enterprise'

export interface User {
    userid: number
    username: string
    maxCount: number
    planType: PlanType
    createdAt: Date
}

export interface UserInternal extends User {
    passwordHash: string
    authtoken: string | null
    authtokenExpiresAt: Date | null
    apitoken: string
    failedLoginAttempts: number
    lockedUntil: Date | null
}

export interface PlanLimit {
    planType: PlanType
    dailyLimit: number
    description: string
}

export interface RateLimitStatus {
    logid: number
    userid: number
    endpoint: string
    createdAt: Date
}

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    limit: number
    resetAt: Date
}

export interface ApiLog {
    logid: number
    userid: number | null
    endpoint: string
    method: string
    requestParams: Record<string, string> | null
    responseStatus: number
    responseTimeMs: number | null
    ipAddress: string | null
    createdAt: Date
}

export interface LoginRequest {
    username: string
    password: string
}

export interface RegisterRequest {
    username: string
    password: string
}

export interface AuthResponse {
    user: User
    apitoken: string
}

export interface LoginResponse {
    user: User
}
