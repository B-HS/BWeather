export interface Location {
    code: string
    level1: string
    level2: string | null
    level3: string | null
    gridX: number
    gridY: number
    longitude: number
    latitude: number
}

export interface CurrentWeather {
    id: number
    gridX: number
    gridY: number
    baseDate: string
    baseTime: string
    temperature: number
    humidity: number
    rainfall: number
    windDirection: number
    windSpeed: number
    windU: number
    windV: number
    windDirectionText: string
    createdAt: Date
}

export interface UltraShortForecast {
    id: number
    gridX: number
    gridY: number
    baseDate: string
    baseTime: string
    fcstDate: string
    fcstTime: string
    temperature: number
    humidity: number
    sky: number
    pty: number
    rainfall: number
    lightning: number
    windDirection: number
    windSpeed: number
    skyText: string
    ptyText: string
    windDirectionText: string
    createdAt: Date
}

export interface ShortTermForecast {
    id: number
    gridX: number
    gridY: number
    baseDate: string
    baseTime: string
    fcstDate: string
    fcstTime: string
    temperature: number | null
    tempMin: number | null
    tempMax: number | null
    humidity: number | null
    sky: number
    pty: number
    pop: number | null
    rainfall: string | null
    snowfall: string | null
    windDirection: number
    windSpeed: number
    skyText: string
    ptyText: string
    windDirectionText: string
    rainfallText: string
    snowfallText: string
    createdAt: Date
}

export interface KMAResponseHeader {
    resultCode: string
    resultMsg: string
}

export interface KMAResponseBody<T> {
    dataType: string
    items: {
        item: T[]
    }
    pageNo: number
    numOfRows: number
    totalCount: number
}

export interface KMAResponse<T> {
    response: {
        header: KMAResponseHeader
        body: KMAResponseBody<T>
    }
}

export interface KMAWeatherItem {
    baseDate: string
    baseTime: string
    category: string
    fcstDate?: string
    fcstTime?: string
    nx: number
    ny: number
    obsrValue?: string
    fcstValue?: string
}

export interface KMAVersionItem {
    filetype: string
    version: string
}

export interface ErrorResponse {
    success: false
    error: {
        code: string
        message: string
    }
}

export interface SuccessResponse<T> {
    success: true
    data: T
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

