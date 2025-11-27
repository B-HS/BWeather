import type { Location } from '@model/types'

const CELL_SIZE = 0.1

export class SpatialIndex {
    private grid: Map<string, Location[]> = new Map()

    constructor(locations: Location[]) {
        for (const loc of locations) {
            const key = this.getCellKey(loc.latitude, loc.longitude)
            if (!this.grid.has(key)) this.grid.set(key, [])
            this.grid.get(key)!.push(loc)
        }
    }

    private getCellKey(lat: number, lon: number): string {
        return `${Math.floor(lat / CELL_SIZE)}:${Math.floor(lon / CELL_SIZE)}`
    }

    findNearest(lat: number, lon: number): Location | undefined {
        const candidates: Location[] = []

        for (let dLat = -1; dLat <= 1; dLat++) {
            for (let dLon = -1; dLon <= 1; dLon++) {
                const key = `${Math.floor(lat / CELL_SIZE) + dLat}:${Math.floor(lon / CELL_SIZE) + dLon}`
                const cell = this.grid.get(key)
                if (cell) candidates.push(...cell)
            }
        }

        if (candidates.length === 0) return undefined

        let nearest: Location | undefined
        let minDistance = Infinity

        for (const loc of candidates) {
            const distance = Math.sqrt(Math.pow(loc.latitude - lat, 2) + Math.pow(loc.longitude - lon, 2))
            if (distance < minDistance) {
                minDistance = distance
                nearest = loc
            }
        }

        return nearest
    }
}
