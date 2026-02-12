import { getDb } from '../lib/db'

export interface CurrentWeatherData {
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
}

export interface UltraForecastData {
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
}

export interface ShortForecastData {
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
}

export const saveCurrentWeather = async (data: CurrentWeatherData) => {
    const db = getDb()
    await db.unsafe(
        `INSERT INTO weather_current
            (grid_x, grid_y, base_date, base_time, temperature, humidity, rainfall, wind_direction, wind_speed, wind_u, wind_v)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            temperature = VALUES(temperature),
            humidity = VALUES(humidity),
            rainfall = VALUES(rainfall),
            wind_direction = VALUES(wind_direction),
            wind_speed = VALUES(wind_speed),
            wind_u = VALUES(wind_u),
            wind_v = VALUES(wind_v)`,
        [
            data.gridX,
            data.gridY,
            data.baseDate,
            data.baseTime,
            data.temperature,
            data.humidity,
            data.rainfall,
            data.windDirection,
            data.windSpeed,
            data.windU,
            data.windV,
        ]
    )
}

export const saveUltraForecasts = async (gridX: number, gridY: number, baseDate: string, baseTime: string, forecasts: Omit<UltraForecastData, 'gridX' | 'gridY' | 'baseDate' | 'baseTime'>[]) => {
    const db = getDb()
    for (const forecast of forecasts) {
        await db.unsafe(
            `INSERT INTO weather_ultra
                (grid_x, grid_y, fcst_date, fcst_time, base_date, base_time, temperature, humidity, sky, pty, rainfall, lightning, wind_direction, wind_speed)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                base_date = VALUES(base_date),
                base_time = VALUES(base_time),
                temperature = VALUES(temperature),
                humidity = VALUES(humidity),
                sky = VALUES(sky),
                pty = VALUES(pty),
                rainfall = VALUES(rainfall),
                lightning = VALUES(lightning),
                wind_direction = VALUES(wind_direction),
                wind_speed = VALUES(wind_speed)`,
            [
                gridX,
                gridY,
                forecast.fcstDate,
                forecast.fcstTime,
                baseDate,
                baseTime,
                forecast.temperature,
                forecast.humidity,
                forecast.sky,
                forecast.pty,
                forecast.rainfall,
                forecast.lightning,
                forecast.windDirection,
                forecast.windSpeed,
            ]
        )
    }
}

export const saveShortForecasts = async (gridX: number, gridY: number, baseDate: string, baseTime: string, forecasts: Omit<ShortForecastData, 'gridX' | 'gridY' | 'baseDate' | 'baseTime'>[]) => {
    const db = getDb()
    for (const forecast of forecasts) {
        await db.unsafe(
            `INSERT INTO weather_short
                (grid_x, grid_y, fcst_date, fcst_time, base_date, base_time, temperature, temp_min, temp_max, humidity, sky, pty, pop, rainfall, snowfall, wind_direction, wind_speed)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                base_date = VALUES(base_date),
                base_time = VALUES(base_time),
                temperature = VALUES(temperature),
                temp_min = VALUES(temp_min),
                temp_max = VALUES(temp_max),
                humidity = VALUES(humidity),
                sky = VALUES(sky),
                pty = VALUES(pty),
                pop = VALUES(pop),
                rainfall = VALUES(rainfall),
                snowfall = VALUES(snowfall),
                wind_direction = VALUES(wind_direction),
                wind_speed = VALUES(wind_speed)`,
            [
                gridX,
                gridY,
                forecast.fcstDate,
                forecast.fcstTime,
                baseDate,
                baseTime,
                forecast.temperature,
                forecast.tempMin,
                forecast.tempMax,
                forecast.humidity,
                forecast.sky,
                forecast.pty,
                forecast.pop,
                forecast.rainfall,
                forecast.snowfall,
                forecast.windDirection,
                forecast.windSpeed,
            ]
        )
    }
}

export const getCurrentWeather = async (gridX: number, gridY: number, baseDate: string, baseTime: string) => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT * FROM weather_current WHERE grid_x = ? AND grid_y = ? AND base_date = ? AND base_time = ?`,
        [gridX, gridY, baseDate, baseTime]
    )
    return result[0] || null
}

export const getUltraForecasts = async (gridX: number, gridY: number) => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT * FROM weather_ultra WHERE grid_x = ? AND grid_y = ? ORDER BY fcst_date, fcst_time`,
        [gridX, gridY]
    )
    return result
}

export const getShortForecasts = async (gridX: number, gridY: number) => {
    const db = getDb()
    const result = await db.unsafe(
        `SELECT * FROM weather_short WHERE grid_x = ? AND grid_y = ? ORDER BY fcst_date, fcst_time`,
        [gridX, gridY]
    )
    return result
}
