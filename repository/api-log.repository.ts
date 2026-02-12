import { getDb } from '../lib/db'
import type { ApiLog } from '../model/auth.types'

export interface CreateApiLogData {
    userid: number | null
    endpoint: string
    method: string
    requestParams: Record<string, string> | null
    responseStatus: number
    responseTimeMs: number | null
    ipAddress: string | null
}

export const createLog = async (data: CreateApiLogData) => {
    const db = getDb()
    await db.unsafe(
        `INSERT INTO api_logs
            (userid, endpoint, method, request_params, response_status, response_time_ms, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.userid,
            data.endpoint,
            data.method,
            data.requestParams ? JSON.stringify(data.requestParams) : null,
            data.responseStatus,
            data.responseTimeMs,
            data.ipAddress,
        ]
    )
}

export const getLogsByUser = async (
    userid: number,
    limit: number = 20,
    offset: number = 0
): Promise<ApiLog[]> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT logid, userid, endpoint, method, request_params, response_status, response_time_ms, ip_address, created_at
        FROM api_logs WHERE userid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [userid, limit, offset]
    )
    return result.map(mapToApiLog)
}

export const getLogsCountByUser = async (userid: number): Promise<number> => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT COUNT(*) as count FROM api_logs WHERE userid = ?`,
        [userid]
    )
    return Number(result[0]?.count ?? 0)
}

const mapToApiLog = (row: Record<string, unknown>): ApiLog => {
    let requestParams = null
    if (row.request_params) {
        if (typeof row.request_params === 'string') {
            requestParams = JSON.parse(row.request_params)
        } else {
            requestParams = row.request_params as Record<string, string>
        }
    }
    return {
        logid: row.logid as number,
        userid: row.userid as number | null,
        endpoint: row.endpoint as string,
        method: row.method as string,
        requestParams,
        responseStatus: row.response_status as number,
        responseTimeMs: row.response_time_ms as number | null,
        ipAddress: row.ip_address as string | null,
        createdAt: new Date(row.created_at as string),
    }
}
