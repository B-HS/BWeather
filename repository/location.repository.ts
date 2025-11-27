import type { Location } from '@model/types'
import { SpatialIndex } from '@lib/spatial-index'
import locationsData from '../data/locations.json'

const locations: Location[] = locationsData as Location[]
const spatialIndex = new SpatialIndex(locations)

export const getAllLocations = (): Location[] => locations

export const searchLocations = (query: string): Location[] => {
    const q = query.toLowerCase()
    return locations.filter(
        (loc) => loc.level1.toLowerCase().includes(q) || loc.level2?.toLowerCase().includes(q) || loc.level3?.toLowerCase().includes(q),
    )
}

export const getLocationByGrid = (gridX: number, gridY: number): Location | undefined =>
    locations.find((loc) => loc.gridX === gridX && loc.gridY === gridY)


export const findNearestLocation = (lat: number, lon: number): Location | undefined => spatialIndex.findNearest(lat, lon)
