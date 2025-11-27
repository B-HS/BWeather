import { Hono } from 'hono'
import { getAllLocations, searchLocations, getLocationByGrid, findNearestLocation } from '@repository/location.repository'
import { latLonToGrid, gridToLatLon } from '@lib/grid-converter'

const locations = new Hono()

locations.get('/', (c) => {
    const results = getAllLocations()
    return c.json({ success: true, data: results })
})

locations.get('/convert', (c) => {
    const lat = c.req.query('lat')
    const lon = c.req.query('lon')
    const gridX = c.req.query('gridX')
    const gridY = c.req.query('gridY')

    if (lat && lon) {
        const latNum = parseFloat(lat)
        const lonNum = parseFloat(lon)

        if (isNaN(latNum) || isNaN(lonNum)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_PARAMETERS', message: 'lat and lon must be numbers' },
                },
                400,
            )
        }

        const grid = latLonToGrid(latNum, lonNum)
        const nearest = findNearestLocation(latNum, lonNum)

        return c.json({
            success: true,
            data: {
                gridX: grid.x,
                gridY: grid.y,
                nearestLocation: nearest,
            },
        })
    }

    if (gridX && gridY) {
        const x = parseInt(gridX, 10)
        const y = parseInt(gridY, 10)

        if (isNaN(x) || isNaN(y)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_PARAMETERS', message: 'gridX and gridY must be numbers' },
                },
                400,
            )
        }

        const latLon = gridToLatLon(x, y)
        const location = getLocationByGrid(x, y)

        return c.json({
            success: true,
            data: {
                latitude: latLon.lat,
                longitude: latLon.lon,
                location,
            },
        })
    }

    return c.json(
        {
            success: false,
            error: { code: 'MISSING_PARAMETERS', message: 'lat/lon or gridX/gridY required' },
        },
        400,
    )
})

locations.get('/:keyword', (c) => {
    const keyword = c.req.param('keyword')
    const results = searchLocations(keyword)
    return c.json({ success: true, data: results })
})

export default locations
