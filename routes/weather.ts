import { Hono } from 'hono'
import type { ApiResponse, KMAWeatherItem } from '@model/types'
import { getUltraSrtNcst, getUltraSrtFcst, getVilageFcst, getFcstVersion } from '@lib/kma-api'
import { getSkyText, getPtyText, getPtyTextShort, getRainfallText, getSnowfallText } from '@lib/weather-codes'
import { getWindDirectionText } from '@lib/wind-direction'
import { searchLocations } from '@repository/location.repository'
import { saveCurrentWeather, saveUltraForecasts, saveShortForecasts } from '@repository/weather.repository'

const weather = new Hono()

const getErrorStatusCode = (errorCode: string): 500 | 502 | 503 | 404 => {
    const statusMap: Record<string, 500 | 502 | 503 | 404> = {
        EXTERNAL_API_ERROR: 502,
        DATA_NOT_FOUND: 404,
        SERVICE_UNAVAILABLE: 503,
    }
    return statusMap[errorCode] || 500
}

const validateCoordinates = (nx: number, ny: number): boolean => nx >= 1 && nx <= 149 && ny >= 1 && ny <= 253

const resolveCoordinates = (
    nx: string | undefined,
    ny: string | undefined,
    location: string | undefined,
): { gridX: number; gridY: number } | null => {
    if (nx && ny) {
        const gridX = parseInt(nx, 10)
        const gridY = parseInt(ny, 10)
        if (!isNaN(gridX) && !isNaN(gridY)) {
            return { gridX, gridY }
        }
    }

    if (location) {
        const results = searchLocations(location)
        if (results.length > 0) {
            return { gridX: results[0].gridX, gridY: results[0].gridY }
        }
    }

    return null
}

type CoordinateResult =
    | { success: true; coords: { gridX: number; gridY: number } }
    | { success: false; error: { code: string; message: string } }

const parseAndValidateCoordinates = (
    nx: string | undefined,
    ny: string | undefined,
    location: string | undefined
): CoordinateResult => {
    if (!nx && !ny && !location) {
        return {
            success: false,
            error: { code: 'MISSING_PARAMETERS', message: 'nx/ny or location required' },
        }
    }

    const coords = resolveCoordinates(nx, ny, location)
    if (!coords) {
        return {
            success: false,
            error: { code: 'INVALID_COORDINATES', message: 'Invalid coordinates or location not found' },
        }
    }

    if (!validateCoordinates(coords.gridX, coords.gridY)) {
        return {
            success: false,
            error: { code: 'INVALID_COORDINATES', message: 'Coordinates out of range (nx: 1-149, ny: 1-253)' },
        }
    }

    return { success: true, coords }
}

const parseCurrentWeather = (items: KMAWeatherItem[]) => {
    const data: Record<string, string> = {}
    for (const item of items) {
        data[item.category] = item.obsrValue || ''
    }

    return {
        temperature: parseFloat(data.T1H) || 0,
        humidity: parseInt(data.REH) || 0,
        rainfall: parseFloat(data.RN1) || 0,
        windDirection: parseInt(data.VEC) || 0,
        windSpeed: parseFloat(data.WSD) || 0,
        windU: parseFloat(data.UUU) || 0,
        windV: parseFloat(data.VVV) || 0,
        pty: parseInt(data.PTY) || 0,
    }
}

const getBaseDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    return {
        baseDate: year + month + day,
        baseTime: hour + '00',
    }
}

weather.get('/current', async (c) => {
    const result = parseAndValidateCoordinates(
        c.req.query('nx'),
        c.req.query('ny'),
        c.req.query('location')
    )
    if (!result.success) {
        return c.json({ success: false, error: result.error } as ApiResponse<never>, 400)
    }
    const { coords } = result

    const { baseDate, baseTime } = getBaseDateTime()

    const apiResult = await getUltraSrtNcst(coords.gridX, coords.gridY)
    if (!apiResult.success) {
        return c.json(apiResult, getErrorStatusCode(apiResult.error.code))
    }

    const parsed = parseCurrentWeather(apiResult.data)
    const response = {
        gridX: coords.gridX,
        gridY: coords.gridY,
        baseDate,
        baseTime,
        ...parsed,
        windDirectionText: getWindDirectionText(parsed.windDirection),
        ptyText: getPtyText(parsed.pty),
    }

    saveCurrentWeather({
        gridX: coords.gridX,
        gridY: coords.gridY,
        baseDate,
        baseTime,
        temperature: parsed.temperature,
        humidity: parsed.humidity,
        rainfall: parsed.rainfall,
        windDirection: parsed.windDirection,
        windSpeed: parsed.windSpeed,
        windU: parsed.windU,
        windV: parsed.windV,
    }).catch((err) => console.error('DB save failed:', err))

    return c.json({ success: true, data: response })
})

weather.get('/ultra-short', async (c) => {
    const result = parseAndValidateCoordinates(
        c.req.query('nx'),
        c.req.query('ny'),
        c.req.query('location')
    )
    if (!result.success) {
        return c.json({ success: false, error: result.error } as ApiResponse<never>, 400)
    }
    const { coords } = result

    const apiResult = await getUltraSrtFcst(coords.gridX, coords.gridY)
    if (!apiResult.success) {
        return c.json(apiResult, getErrorStatusCode(apiResult.error.code))
    }

    const forecasts = new Map<string, Record<string, string>>()
    for (const item of apiResult.data) {
        const key = (item.fcstDate || '') + (item.fcstTime || '')
        if (!forecasts.has(key)) {
            forecasts.set(key, { fcstDate: item.fcstDate || '', fcstTime: item.fcstTime || '' })
        }
        const entry = forecasts.get(key)
        if (entry) entry[item.category] = item.fcstValue || ''
    }

    const apiBaseDate = apiResult.data[0]?.baseDate || ''
    const apiBaseTime = apiResult.data[0]?.baseTime || ''

    const response = Array.from(forecasts.values()).map((f) => ({
        fcstDate: f.fcstDate,
        fcstTime: f.fcstTime,
        temperature: parseFloat(f.T1H) || 0,
        humidity: parseInt(f.REH) || 0,
        sky: parseInt(f.SKY) || 1,
        pty: parseInt(f.PTY) || 0,
        rainfall: parseFloat(f.RN1) || 0,
        lightning: parseFloat(f.LGT) || 0,
        windDirection: parseInt(f.VEC) || 0,
        windSpeed: parseFloat(f.WSD) || 0,
        skyText: getSkyText(parseInt(f.SKY) || 1),
        ptyText: getPtyText(parseInt(f.PTY) || 0),
        windDirectionText: getWindDirectionText(parseInt(f.VEC) || 0),
    }))

    const responseData = { gridX: coords.gridX, gridY: coords.gridY, forecasts: response }

    saveUltraForecasts(
        coords.gridX,
        coords.gridY,
        apiBaseDate,
        apiBaseTime,
        response.map((f) => ({
            fcstDate: f.fcstDate,
            fcstTime: f.fcstTime,
            temperature: f.temperature,
            humidity: f.humidity,
            sky: f.sky,
            pty: f.pty,
            rainfall: f.rainfall,
            lightning: f.lightning,
            windDirection: f.windDirection,
            windSpeed: f.windSpeed,
        }))
    ).catch((err) => console.error('DB save failed:', err))

    return c.json({ success: true, data: responseData })
})

weather.get('/short-term', async (c) => {
    const result = parseAndValidateCoordinates(
        c.req.query('nx'),
        c.req.query('ny'),
        c.req.query('location')
    )
    if (!result.success) {
        return c.json({ success: false, error: result.error } as ApiResponse<never>, 400)
    }
    const { coords } = result

    const apiResult = await getVilageFcst(coords.gridX, coords.gridY)
    if (!apiResult.success) {
        return c.json(apiResult, getErrorStatusCode(apiResult.error.code))
    }

    const apiBaseDate = apiResult.data[0]?.baseDate || ''
    const apiBaseTime = apiResult.data[0]?.baseTime || ''

    const forecasts = new Map<string, Record<string, string>>()
    for (const item of apiResult.data) {
        const key = (item.fcstDate || '') + (item.fcstTime || '')
        if (!forecasts.has(key)) {
            forecasts.set(key, { fcstDate: item.fcstDate || '', fcstTime: item.fcstTime || '' })
        }
        const entry = forecasts.get(key)
        if (entry) entry[item.category] = item.fcstValue || ''
    }

    const response = Array.from(forecasts.values()).map((f) => ({
        fcstDate: f.fcstDate,
        fcstTime: f.fcstTime,
        temperature: f.TMP ? parseFloat(f.TMP) : null,
        tempMin: f.TMN ? parseFloat(f.TMN) : null,
        tempMax: f.TMX ? parseFloat(f.TMX) : null,
        humidity: f.REH ? parseInt(f.REH) : null,
        sky: parseInt(f.SKY) || 1,
        pty: parseInt(f.PTY) || 0,
        pop: f.POP ? parseInt(f.POP) : null,
        rainfall: f.PCP || null,
        snowfall: f.SNO || null,
        windDirection: parseInt(f.VEC) || 0,
        windSpeed: parseFloat(f.WSD) || 0,
        skyText: getSkyText(parseInt(f.SKY) || 1),
        ptyText: getPtyTextShort(parseInt(f.PTY) || 0),
        windDirectionText: getWindDirectionText(parseInt(f.VEC) || 0),
        rainfallText: getRainfallText(f.PCP || '강수없음'),
        snowfallText: getSnowfallText(f.SNO || '적설없음'),
    }))

    const responseData = { gridX: coords.gridX, gridY: coords.gridY, forecasts: response }

    saveShortForecasts(
        coords.gridX,
        coords.gridY,
        apiBaseDate,
        apiBaseTime,
        response.map((f) => ({
            fcstDate: f.fcstDate,
            fcstTime: f.fcstTime,
            temperature: f.temperature,
            tempMin: f.tempMin,
            tempMax: f.tempMax,
            humidity: f.humidity,
            sky: f.sky,
            pty: f.pty,
            pop: f.pop,
            rainfall: f.rainfall,
            snowfall: f.snowfall,
            windDirection: f.windDirection,
            windSpeed: f.windSpeed,
        }))
    ).catch((err) => console.error('DB save failed:', err))

    return c.json({ success: true, data: responseData })
})

weather.get('/version', async (c) => {
    const ftype = c.req.query('ftype')

    if (!ftype) {
        return c.json(
            {
                success: false,
                error: { code: 'MISSING_PARAMETERS', message: 'ftype required (ODAM, VSRT, SHRT)' },
            } as ApiResponse<never>,
            400,
        )
    }

    const validTypes = ['ODAM', 'VSRT', 'SHRT']
    if (!validTypes.includes(ftype)) {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_FTYPE', message: 'ftype must be one of: ODAM, VSRT, SHRT' },
            } as ApiResponse<never>,
            400,
        )
    }

    const result = await getFcstVersion(ftype)
    return c.json(result, result.success ? 200 : 500)
})

export default weather
