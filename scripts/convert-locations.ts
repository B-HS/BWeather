import * as XLSX from 'xlsx'
import type { Location } from '@model/types'

const EXCEL_PATH = './masterdata/raw_location.xlsx'
const OUTPUT_PATH = './data/locations.json'

const main = async () => {
    console.log('Reading Excel file...')
    const workbook = XLSX.readFile(EXCEL_PATH)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet)

    console.log(`Found ${rows.length} rows`)

    const locations: Location[] = rows
        .map((row) => ({
            code: String(row['행정구역코드'] || row['code'] || ''),
            level1: String(row['1단계'] || row['level1'] || ''),
            level2: row['2단계'] || row['level2'] ? String(row['2단계'] || row['level2']) : null,
            level3: row['3단계'] || row['level3'] ? String(row['3단계'] || row['level3']) : null,
            gridX: Number(row['격자 X'] || row['gridX'] || row['nx'] || 0),
            gridY: Number(row['격자 Y'] || row['gridY'] || row['ny'] || 0),
            longitude: Number(row['경도(초/100)'] || row['longitude'] || row['lon'] || 0),
            latitude: Number(row['위도(초/100)'] || row['latitude'] || row['lat'] || 0),
        }))
        .filter((loc) => loc.code && loc.gridX > 0 && loc.gridY > 0)

    console.log(`Converted ${locations.length} locations`)

    await Bun.write(OUTPUT_PATH, JSON.stringify(locations, null, 2))
    console.log(`Saved to ${OUTPUT_PATH}`)
}

main().catch(console.error)
