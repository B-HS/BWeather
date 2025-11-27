# BWeather API

대한민국 기상청 단기예보 API를 래핑한 날씨 API 서버입니다.

## 설치 및 실행

```bash
# 의존성 설치
bun install

# 데이터베이스 설정
bun run db:setup

# 개발 서버 실행
bun run dev

# 프로덕션 실행
bun run start

# 테스트 실행
bun test
```

서버 주소: http://localhost:3000

## 환경 변수

`.env` 파일을 생성하고 다음 값들을 설정하세요:

```env
# KMA API (https://data.go.kr 에서 발급)
KMA_API_KEY=your_api_key_here

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=bweather
MYSQL_USER=root
MYSQL_PASSWORD=password

# Server
PORT=3000
```

기상청 API 키는 [공공데이터포털](https://www.data.go.kr/)에서 발급받을 수 있습니다.

## Docker

```bash
# 이미지 빌드
docker build -t bweather:latest .

# 실행
docker compose up -d
```

---

## API 문서

### 공통 응답 형식

**성공**

```json
{
  "success": true,
  "data": { ... }
}
```

**실패**

```json
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "에러 메시지"
    }
}
```

---

## 기본 엔드포인트

### GET /

API 정보를 반환합니다.

**Response**

```json
{
    "message": "BWeather API",
    "version": "1.0.0"
}
```

### GET /health

헬스 체크 엔드포인트입니다.

**Response**

```json
{
    "status": "ok"
}
```

---

## 위치 API

### GET /api/locations

전체 위치 목록을 반환합니다 (3,834개).

**Response**

```json
{
    "success": true,
    "data": [
        {
            "code": "1100000000",
            "level1": "서울특별시",
            "level2": "종로구",
            "level3": "청운효자동",
            "gridX": 60,
            "gridY": 127,
            "longitude": 126.9779,
            "latitude": 37.5866
        }
    ]
}
```

### GET /api/locations/:keyword

키워드로 위치를 검색합니다. level1(시도), level2(시군구), level3(읍면동)에서 검색합니다.

**Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| keyword | path | 검색어 (예: 종로, 강남, 부산) |

**Example**

```
GET /api/locations/종로
GET /api/locations/강남구
GET /api/locations/부산
```

**Response**

```json
{
    "success": true,
    "data": [
        {
            "code": "1111000000",
            "level1": "서울특별시",
            "level2": "종로구",
            "level3": null,
            "gridX": 60,
            "gridY": 127,
            "longitude": 126.9816,
            "latitude": 37.594
        }
    ]
}
```

### GET /api/locations/convert

위경도 ↔ 격자 좌표 변환을 수행합니다.

**Parameters (위경도 → 격자)**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| lat | query | 위도 (예: 37.5665) |
| lon | query | 경도 (예: 126.9780) |

**Parameters (격자 → 위경도)**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| gridX | query | 격자 X (예: 60) |
| gridY | query | 격자 Y (예: 127) |

**Example**

```
GET /api/locations/convert?lat=37.5665&lon=126.9780
GET /api/locations/convert?gridX=60&gridY=127
```

**Response (위경도 → 격자)**

```json
{
    "success": true,
    "data": {
        "gridX": 60,
        "gridY": 127,
        "nearestLocation": {
            "code": "1111000000",
            "level1": "서울특별시",
            "level2": "종로구",
            "level3": null,
            "gridX": 60,
            "gridY": 127,
            "longitude": 126.9816,
            "latitude": 37.594
        }
    }
}
```

**Response (격자 → 위경도)**

```json
{
    "success": true,
    "data": {
        "latitude": 37.579,
        "longitude": 126.977,
        "location": {
            "code": "1111000000",
            "level1": "서울특별시",
            "level2": "종로구",
            "level3": null,
            "gridX": 60,
            "gridY": 127
        }
    }
}
```

---

## 날씨 API

### GET /api/weather/current

현재 날씨 (초단기실황)를 반환합니다.

**Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| nx | query | O* | 격자 X 좌표 (1-149) |
| ny | query | O* | 격자 Y 좌표 (1-253) |
| location | query | O\* | 지역명 검색 (nx/ny 대신 사용 가능) |

\*nx/ny 또는 location 중 하나 필수

**Example**

```
GET /api/weather/current?nx=60&ny=127
GET /api/weather/current?location=종로구
```

**Response**

```json
{
    "success": true,
    "data": {
        "gridX": 60,
        "gridY": 127,
        "baseDate": "20251127",
        "baseTime": "1400",
        "temperature": 5.2,
        "humidity": 45,
        "rainfall": 0,
        "windDirection": 270,
        "windSpeed": 2.1,
        "windU": -2.1,
        "windV": 0,
        "pty": 0,
        "windDirectionText": "W",
        "ptyText": "없음"
    }
}
```

**필드 설명**
| 필드 | 타입 | 설명 |
|-----|------|------|
| temperature | number | 기온 (°C) |
| humidity | number | 습도 (%) |
| rainfall | number | 1시간 강수량 (mm) |
| windDirection | number | 풍향 (°) |
| windSpeed | number | 풍속 (m/s) |
| windU | number | 동서 바람성분 (m/s) |
| windV | number | 남북 바람성분 (m/s) |
| pty | number | 강수형태 코드 |
| windDirectionText | string | 풍향 (N, NE, E, SE, S, SW, W, NW 등) |
| ptyText | string | 강수형태 텍스트 |

### GET /api/weather/ultra-short

초단기예보 (6시간)를 반환합니다.

**Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| nx | query | O* | 격자 X 좌표 |
| ny | query | O* | 격자 Y 좌표 |
| location | query | O\* | 지역명 검색 |

**Example**

```
GET /api/weather/ultra-short?nx=60&ny=127
```

**Response**

```json
{
    "success": true,
    "data": {
        "gridX": 60,
        "gridY": 127,
        "forecasts": [
            {
                "fcstDate": "20251127",
                "fcstTime": "1500",
                "temperature": 5.5,
                "humidity": 43,
                "sky": 1,
                "pty": 0,
                "rainfall": 0,
                "lightning": 0,
                "windDirection": 280,
                "windSpeed": 2.3,
                "skyText": "맑음",
                "ptyText": "없음",
                "windDirectionText": "W"
            }
        ]
    }
}
```

### GET /api/weather/short-term

단기예보 (3일)를 반환합니다.

**Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| nx | query | O* | 격자 X 좌표 |
| ny | query | O* | 격자 Y 좌표 |
| location | query | O\* | 지역명 검색 |

**Example**

```
GET /api/weather/short-term?nx=60&ny=127
```

**Response**

```json
{
    "success": true,
    "data": {
        "gridX": 60,
        "gridY": 127,
        "forecasts": [
            {
                "fcstDate": "20251127",
                "fcstTime": "1800",
                "temperature": 4.0,
                "tempMin": null,
                "tempMax": null,
                "humidity": 50,
                "sky": 1,
                "pty": 0,
                "pop": 0,
                "rainfall": "강수없음",
                "snowfall": "적설없음",
                "windDirection": 290,
                "windSpeed": 1.8,
                "skyText": "맑음",
                "ptyText": "없음",
                "windDirectionText": "WNW",
                "rainfallText": "강수없음",
                "snowfallText": "적설없음"
            }
        ]
    }
}
```

**추가 필드**
| 필드 | 타입 | 설명 |
|-----|------|------|
| tempMin | number \| null | 일 최저기온 (°C) |
| tempMax | number \| null | 일 최고기온 (°C) |
| pop | number \| null | 강수확률 (%) |
| rainfall | string \| null | 강수량 범위 |
| snowfall | string \| null | 적설량 범위 |

### GET /api/weather/version

예보 버전 정보를 반환합니다.

**Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| ftype | query | O | 예보 타입 (ODAM, VSRT, SHRT) |

**ftype 값**
| 값 | 설명 |
|----|------|
| ODAM | 초단기실황 |
| VSRT | 초단기예보 |
| SHRT | 단기예보 |

**Example**

```
GET /api/weather/version?ftype=ODAM
```

**Response**

```json
{
    "success": true,
    "data": {
        "filetype": "ODAM",
        "version": "202511271400"
    }
}
```

---

## 코드 값 참조

### 하늘 상태 (sky)

| 코드 | 설명     |
| ---- | -------- |
| 1    | 맑음     |
| 3    | 구름많음 |
| 4    | 흐림     |

### 강수 형태 - 초단기실황/초단기예보 (pty)

| 코드 | 설명         |
| ---- | ------------ |
| 0    | 없음         |
| 1    | 비           |
| 2    | 비/눈        |
| 3    | 눈           |
| 5    | 빗방울       |
| 6    | 빗방울눈날림 |
| 7    | 눈날림       |

### 강수 형태 - 단기예보 (pty)

| 코드 | 설명   |
| ---- | ------ |
| 0    | 없음   |
| 1    | 비     |
| 2    | 비/눈  |
| 3    | 눈     |
| 4    | 소나기 |

### 풍향 (windDirectionText)

| 코드 | 방향     |
| ---- | -------- |
| N    | 북       |
| NNE  | 북북동   |
| NE   | 북동     |
| ENE  | 동북동   |
| E    | 동       |
| ESE  | 동남동   |
| SE   | 남동     |
| SSE  | 남남동   |
| S    | 남       |
| SSW  | 남남서   |
| SW   | 남서     |
| WSW  | 서남서   |
| W    | 서       |
| WNW  | 서북서   |
| NW   | 북서     |
| NNW  | 북북서   |

---

## 에러 코드

| 코드                | HTTP | 설명                                    |
| ------------------- | ---- | --------------------------------------- |
| MISSING_PARAMETERS  | 400  | 필수 파라미터 누락                      |
| INVALID_PARAMETERS  | 400  | 파라미터 값이 유효하지 않음             |
| INVALID_COORDINATES | 400  | 좌표 범위 초과 또는 위치를 찾을 수 없음 |
| INVALID_FTYPE       | 400  | 유효하지 않은 예보 타입                 |
| FETCH_ERROR         | 500  | 기상청 API 호출 실패                    |
| MAX_RETRIES         | 500  | API 재시도 횟수 초과                    |
| INTERNAL_ERROR      | 500  | 내부 서버 오류                          |
| NOT_FOUND           | 404  | 존재하지 않는 엔드포인트                |

---

## 프로젝트 구조

```
bweather/
├── index.ts                 # 앱 진입점
├── routes/
│   ├── locations.ts         # 위치 API
│   └── weather.ts           # 날씨 API
├── repository/
│   ├── location.repository.ts  # 위치 데이터 접근
│   └── weather.repository.ts   # 날씨 데이터 저장
├── lib/
│   ├── db.ts                # MySQL 연결
│   ├── kma-api.ts           # 기상청 API 클라이언트
│   ├── weather-cache.ts     # 메모리 캐시 관리
│   ├── grid-converter.ts    # 좌표 변환
│   ├── spatial-index.ts     # 위치 검색 최적화
│   ├── weather-codes.ts     # 날씨 코드 변환
│   └── wind-direction.ts    # 풍향 텍스트 변환
├── middleware/
│   └── error-handler.ts     # 에러 핸들러
├── model/
│   └── types.ts             # TypeScript 타입 정의
├── data/
│   └── locations.json       # 위치 마스터데이터 (3,834개)
├── db/
│   └── schema.sql           # 데이터베이스 스키마
├── scripts/
│   ├── setup-db.ts          # DB 초기화
│   ├── drop-db.ts           # DB 삭제
│   └── convert-locations.ts # 위치 데이터 변환
└── tests/
    ├── unit/                # 단위 테스트
    ├── integration/         # 통합 테스트
    └── e2e/                 # E2E 테스트
```

## 기술 스택

- **Runtime**: Bun
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: MySQL
- **Data Source**: 기상청 단기예보 API
