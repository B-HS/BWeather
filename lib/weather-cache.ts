import type { WeatherCacheKey, CacheEntry } from '@model/types'

export class WeatherCache {
    private cache: Map<string, CacheEntry<unknown>>
    private cleanupInterval: Timer | null = null

    constructor(cleanupIntervalMs = 5 * 60 * 1000) {
        this.cache = new Map()
        this.startCleanupTimer(cleanupIntervalMs)
    }

    private startCleanupTimer(intervalMs: number) {
        this.cleanupInterval = setInterval(() => this.cleanup(), intervalMs)
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }

    private generateKey(key: WeatherCacheKey): string {
        return `${key.type}:${key.gridX}:${key.gridY}:${key.baseDate}:${key.baseTime}`
    }

    get<T>(key: WeatherCacheKey): T | null {
        const cacheKey = this.generateKey(key)
        const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined

        if (!entry) return null
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(cacheKey)
            return null
        }

        return entry.data
    }

    set<T>(key: WeatherCacheKey, data: T, ttlMs: number): void {
        const cacheKey = this.generateKey(key)
        this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttlMs,
        })
    }

    delete(key: WeatherCacheKey): void {
        const cacheKey = this.generateKey(key)
        this.cache.delete(cacheKey)
    }

    clear(): void {
        this.cache.clear()
    }

    cleanup(): void {
        const now = Date.now()
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key)
            }
        }
    }
}

export const weatherCache = new WeatherCache()
