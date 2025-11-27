const SKY_CODES: Record<number, string> = {
    1: '맑음',
    3: '구름많음',
    4: '흐림',
}

const PTY_CODES: Record<number, string> = {
    0: '없음',
    1: '비',
    2: '비/눈',
    3: '눈',
    5: '빗방울',
    6: '빗방울눈날림',
    7: '눈날림',
}

const PTY_CODES_SHORT: Record<number, string> = {
    0: '없음',
    1: '비',
    2: '비/눈',
    3: '눈',
    4: '소나기',
}

export const getSkyText = (code: number): string => SKY_CODES[code] ?? '알수없음'

export const getPtyText = (code: number): string => PTY_CODES[code] ?? '알수없음'

export const getPtyTextShort = (code: number): string => PTY_CODES_SHORT[code] ?? '알수없음'

export const getRainfallText = (value: string): string => value || '강수없음'

export const getSnowfallText = (value: string): string => value || '적설없음'
