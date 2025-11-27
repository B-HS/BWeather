const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export const getWindDirectionText = (degrees: number): string => {
    const normalized = ((degrees % 360) + 360) % 360
    const index = Math.round(normalized / 22.5) % 16
    return DIRECTIONS[index]
}
