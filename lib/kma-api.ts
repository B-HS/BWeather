import type { ApiResponse, KMAResponse, KMAWeatherItem, KMAVersionItem } from '@model/types'

const BASE_URL = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const getApiKey = (): string => {
    const key = process.env.KMA_API_KEY
    if (!key) throw new Error('KMA_API_KEY is not set')
    return key
}

const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
}

const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}${minutes}`
}

const getBaseDateTime = (type: 'ncst' | 'fcst' | 'vilage'): { baseDate: string; baseTime: string } => {
    const now = new Date()
    const minutes = now.getMinutes()

    if (type === 'ncst') {
        if (minutes < 40) {
            now.setHours(now.getHours() - 1)
        }
        now.setMinutes(0)
    } else if (type === 'fcst') {
        if (minutes < 45) {
            now.setHours(now.getHours() - 1)
        }
        now.setMinutes(30)
    } else {
        const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23]
        const currentHour = now.getHours()
        const currentMinutes = now.getMinutes()

        let baseTime = baseTimes[0]
        for (const bt of baseTimes) {
            if (currentHour > bt || (currentHour === bt && currentMinutes >= 10)) {
                baseTime = bt
            }
        }

        if (currentHour < 2 || (currentHour === 2 && currentMinutes < 10)) {
            now.setDate(now.getDate() - 1)
            baseTime = 23
        }

        now.setHours(baseTime)
        now.setMinutes(0)
    }

    return {
        baseDate: formatDate(now),
        baseTime: formatTime(now),
    }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async <T>(url: string, retries = MAX_RETRIES): Promise<ApiResponse<T>> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as KMAResponse<T>
            const header = data.response?.header

            if (!header) {
                throw new Error('Invalid response structure')
            }

            if (header.resultCode !== '00') {
                const errorCode = mapKmaErrorCode(header.resultCode)
                return {
                    success: false,
                    error: {
                        code: errorCode,
                        message: header.resultMsg,
                    },
                }
            }

            return {
                success: true,
                data: data.response.body.items.item as T,
            }
        } catch (error) {
            if (attempt < retries) {
                await delay(RETRY_DELAY * attempt)
                continue
            }

            return {
                success: false,
                error: {
                    code: 'EXTERNAL_API_ERROR',
                    message: error instanceof Error ? error.message : 'External API request failed',
                },
            }
        }
    }

    return {
        success: false,
        error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Weather service temporarily unavailable',
        },
    }
}

const mapKmaErrorCode = (kmaCode: string): string => {
    const errorMap: Record<string, string> = {
        '01': 'EXTERNAL_API_ERROR',
        '02': 'EXTERNAL_API_ERROR',
        '03': 'DATA_NOT_FOUND',
        '04': 'EXTERNAL_API_ERROR',
        '05': 'EXTERNAL_API_ERROR',
        '10': 'EXTERNAL_API_ERROR',
        '11': 'EXTERNAL_API_ERROR',
        '12': 'EXTERNAL_API_ERROR',
        '20': 'EXTERNAL_API_ERROR',
        '21': 'EXTERNAL_API_ERROR',
        '22': 'EXTERNAL_API_ERROR',
        '30': 'SERVICE_UNAVAILABLE',
        '31': 'SERVICE_UNAVAILABLE',
        '32': 'SERVICE_UNAVAILABLE',
        '99': 'EXTERNAL_API_ERROR',
    }
    return errorMap[kmaCode] || 'EXTERNAL_API_ERROR'
}

export const getUltraSrtNcst = async (nx: number, ny: number): Promise<ApiResponse<KMAWeatherItem[]>> => {
    const { baseDate, baseTime } = getBaseDateTime('ncst')
    const params = new URLSearchParams({
        serviceKey: getApiKey(),
        numOfRows: '10',
        pageNo: '1',
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: String(nx),
        ny: String(ny),
    })

    return fetchWithRetry<KMAWeatherItem[]>(`${BASE_URL}/getUltraSrtNcst?${params}`)
}

export const getUltraSrtFcst = async (nx: number, ny: number): Promise<ApiResponse<KMAWeatherItem[]>> => {
    const { baseDate, baseTime } = getBaseDateTime('fcst')
    const params = new URLSearchParams({
        serviceKey: getApiKey(),
        numOfRows: '60',
        pageNo: '1',
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: String(nx),
        ny: String(ny),
    })

    return fetchWithRetry<KMAWeatherItem[]>(`${BASE_URL}/getUltraSrtFcst?${params}`)
}

export const getVilageFcst = async (nx: number, ny: number): Promise<ApiResponse<KMAWeatherItem[]>> => {
    const { baseDate, baseTime } = getBaseDateTime('vilage')
    const params = new URLSearchParams({
        serviceKey: getApiKey(),
        numOfRows: '1000',
        pageNo: '1',
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: String(nx),
        ny: String(ny),
    })

    return fetchWithRetry<KMAWeatherItem[]>(`${BASE_URL}/getVilageFcst?${params}`)
}

export const getFcstVersion = async (ftype: string): Promise<ApiResponse<KMAVersionItem>> => {
    const { baseDate, baseTime } = getBaseDateTime('vilage')
    const params = new URLSearchParams({
        serviceKey: getApiKey(),
        numOfRows: '1',
        pageNo: '1',
        dataType: 'JSON',
        ftype,
        basedatetime: `${baseDate}${baseTime}`,
    })

    const result = await fetchWithRetry<KMAVersionItem[]>(`${BASE_URL}/getFcstVersion?${params}`)
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        return {
            success: true,
            data: result.data[0],
        }
    }
    return result as ApiResponse<KMAVersionItem>
}
