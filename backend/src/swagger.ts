export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'GreedyRunner API',
    description: '달리기 최적 타이밍 안내 서비스',
    version: '0.1.0',
  },
  servers: [{ url: 'http://localhost:8000', description: '개발 서버' }],
  tags: [
    { name: 'air-quality', description: '대기질 및 러닝 지수 조회' },
    { name: 'stats', description: '방문자 통계' },
    { name: 'health', description: '서버 상태 확인' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: '헬스체크',
        responses: {
          200: {
            description: '서버 정상',
            content: {
              'application/json': {
                example: { status: 'ok' },
              },
            },
          },
        },
      },
    },
    '/api/v1/air-quality/search': {
      get: {
        tags: ['air-quality'],
        summary: '지역 검색',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: '검색어 (예: 강남, 부산)',
            schema: { type: 'string', example: '강남' },
          },
        ],
        responses: {
          200: {
            description: '검색 결과',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegionSearchResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/QuotaExceeded' },
          502: { $ref: '#/components/responses/UpstreamError' },
          504: { $ref: '#/components/responses/UpstreamTimeout' },
        },
      },
    },
    '/api/v1/air-quality/by-coords': {
      get: {
        tags: ['air-quality'],
        summary: '좌표 기반 대기질 조회',
        parameters: [
          {
            name: 'lat',
            in: 'query',
            required: true,
            description: '위도',
            schema: { type: 'number', example: 37.5172 },
          },
          {
            name: 'lng',
            in: 'query',
            required: true,
            description: '경도',
            schema: { type: 'number', example: 127.0473 },
          },
        ],
        responses: {
          200: {
            // 이 엔드포인트는 대기질이 아니라 Region을 돌려준다. 예전 문서는
            // AirQualityResponse라고 적어 두어, 문서만 보고 붙인 클라이언트가
            // 없는 필드를 읽게 됐다.
            description: '가장 가까운 측정소 정보 (이 id로 /{regionId}를 호출한다)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Region' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/QuotaExceeded' },
          502: { $ref: '#/components/responses/UpstreamError' },
          504: { $ref: '#/components/responses/UpstreamTimeout' },
        },
      },
    },
    '/api/v1/air-quality/{regionId}': {
      get: {
        tags: ['air-quality'],
        summary: '지역 ID 기반 대기질 조회',
        parameters: [
          {
            name: 'regionId',
            in: 'path',
            required: true,
            description:
              '지역 ID. `tm:{tmX}:{tmY}`(지역 검색 결과) 또는 `station:{측정소명}`(좌표 조회 결과)',
            schema: { type: 'string', example: 'station:강남구' },
          },
          {
            name: 'lat',
            in: 'query',
            required: false,
            description: '위도. lng와 **쌍으로** 주어야 한다 (하나만 주면 400). 주면 기상·자외선을 함께 조회한다.',
            schema: { type: 'number', example: 37.5172 },
          },
          {
            name: 'lng',
            in: 'query',
            required: false,
            description: '경도. lat와 쌍으로 주어야 한다.',
            schema: { type: 'number', example: 127.0473 },
          },
        ],
        responses: {
          200: {
            description: '대기질 + 기상 + 러닝 지수',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AirQualityResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/QuotaExceeded' },
          500: { $ref: '#/components/responses/ServerConfigError' },
          502: { $ref: '#/components/responses/UpstreamError' },
          503: { $ref: '#/components/responses/UpstreamNoData' },
          504: { $ref: '#/components/responses/UpstreamTimeout' },
        },
      },
    },
    '/api/v1/stats/visitors': {
      get: {
        tags: ['stats'],
        summary: '방문자 수 조회',
        description:
          'Umami 연동. UMAMI_WEBSITE_ID가 설정되지 않았거나 조회에 실패하면 0을 반환한다(200 유지).',
        responses: {
          200: {
            description: '방문자 수',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    today: { type: 'integer', example: 42 },
                    total: { type: 'integer', example: 1280 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    responses: {
      ValidationError: {
        description: '유효성 검사 오류',
        content: {
          'application/json': {
            example: { error: { q: ['검색어를 입력해 주세요.'] } },
          },
        },
      },
      NotFound: {
        description: '지역·측정소를 특정할 수 없음 (regionId 형식 오류 포함)',
        content: { 'application/json': { example: { error: '측정소를 찾을 수 없습니다.' } } },
      },
      QuotaExceeded: {
        description: '공공데이터포털 호출 한도 초과. KST 자정에 리셋되므로 재시도는 무의미하다.',
        content: {
          'application/json': {
            example: { error: '공공데이터포털 API 호출 한도를 초과했습니다. 자정 이후 다시 시도해 주세요.' },
          },
        },
      },
      ServerConfigError: {
        description: '서버의 서비스키 설정 문제. 시간이 지나도 회복되지 않는다.',
        content: {
          'application/json': { example: { error: '서버의 공공데이터포털 서비스키 설정에 문제가 있습니다.' } },
        },
      },
      UpstreamNoData: {
        description: '해당 시각 자료가 아직 발표되지 않음 (직전 발표분 재시도 후에도 없음)',
        content: {
          'application/json': { example: { error: '대기질 정보 조회 자료가 아직 발표되지 않았습니다. 잠시 후 다시 시도해 주세요.' } },
        },
      },
      UpstreamError: {
        description: '상류 API 장애·점검',
        content: { 'application/json': { example: { error: '대기질 정보 조회 중 오류가 발생했습니다.' } } },
      },
      UpstreamTimeout: {
        description: '상류 API 응답 지연',
        content: {
          'application/json': {
            example: { error: '상류 API 응답 지연으로 대기질 정보 조회를 완료할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
          },
        },
      },
    },
    schemas: {
      Region: {
        type: 'object',
        properties: {
          id:        { type: 'string', example: 'seoul-gangnam' },
          name:      { type: 'string', example: '서울 강남구' },
          shortName: { type: 'string', example: '강남구' },
          city:      { type: 'string', example: '서울' },
          lat:       { type: 'number', example: 37.5172 },
          lng:       { type: 'number', example: 127.0473 },
        },
      },
      RegionSearchResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: { $ref: '#/components/schemas/Region' },
          },
        },
      },
      AirQualityMetrics: {
        type: 'object',
        description:
          '측정값. `null`은 "측정소 점검/결측"을 뜻하며 `0`(실제 청정값)과 구분해야 한다.',
        properties: {
          pm25: { type: 'number', nullable: true, description: '초미세먼지 μg/m³', example: 28 },
          pm10: { type: 'number', nullable: true, description: '미세먼지 μg/m³',   example: 45 },
          o3:   { type: 'number', nullable: true, description: '오존 ppm',          example: 0.032 },
          no2:  { type: 'number', nullable: true, description: '이산화질소 ppm',    example: 0.018 },
          co:   { type: 'number', nullable: true, description: '일산화탄소 ppm',    example: 0.6 },
        },
      },
      WeatherInfo: {
        type: 'object',
        description: '좌표를 함께 넘겼고 KMA_API_KEY가 설정된 경우에만 존재한다.',
        properties: {
          temperature:   { type: 'number', description: '기온 °C', example: 18 },
          humidity:      { type: 'number', description: '습도 %', example: 55 },
          windSpeed:     { type: 'number', description: '풍속 m/s', example: 2.1 },
          precipitation: { type: 'string', enum: ['none', 'rain', 'snow', 'sleet'], example: 'none' },
          uvIndex:       { type: 'integer', description: '자외선지수. 없으면 필드가 없다.', example: 4 },
        },
      },
      RunningIndex: {
        type: 'object',
        properties: {
          score:   { type: 'integer', minimum: 0, maximum: 100, description: "status가 'unknown'이면 0", example: 72 },
          status:  {
            type: 'string',
            enum: ['great', 'good', 'caution', 'bad', 'worst', 'unknown'],
            description: "'unknown'은 PM2.5 또는 PM10 결측으로 계산 불가. 0점(최악)과 구분해 표시해야 한다.",
            example: 'good',
          },
          label:   { type: 'string', example: '달리기 좋음' },
          message: { type: 'string', example: '달리기에 좋은 환경입니다.' },
          canRun:  { type: 'boolean', description: "score >= 40. 'unknown'은 항상 false", example: true },
        },
      },
      HourlyForecast: {
        type: 'object',
        properties: {
          hour:         { type: 'integer', minimum: 0, maximum: 23, example: 6 },
          isNextDay:    { type: 'boolean', description: '자정을 넘어간 바에만 true로 존재한다.', example: true },
          airQuality:   { $ref: '#/components/schemas/AirQualityMetrics' },
          weather:      { $ref: '#/components/schemas/WeatherInfo' },
          runningIndex: { $ref: '#/components/schemas/RunningIndex' },
        },
      },
      ServiceStatus: {
        type: 'object',
        description: '상류별 상태. UI가 경고를 띄우는 근거다.',
        properties: {
          airKorea: { type: 'string', enum: ['ok', 'timeout', 'error'], example: 'ok' },
          weather:  { type: 'string', enum: ['ok', 'timeout', 'error', 'unavailable'], description: "'unavailable'은 KMA_API_KEY 미설정 또는 좌표 미전달", example: 'ok' },
        },
      },
      StationFallback: {
        type: 'object',
        description: '1순위 측정소가 결측이라 주변 측정소로 대체한 경우에만 존재한다.',
        properties: {
          originalStation: { type: 'string', example: '강남구' },
          fallbackStation: { type: 'string', example: '서초구' },
          reason:          { type: 'string', example: '강남구 측정소 데이터 비정상 (점검 중 추정)' },
        },
      },
      BestRunningHour: {
        type: 'object',
        properties: {
          hour:      { type: 'integer', minimum: 0, maximum: 23, example: 7 },
          isNextDay: { type: 'boolean', example: false },
        },
      },
      AirQualityResponse: {
        type: 'object',
        properties: {
          regionName: { type: 'string', example: '강남구 측정소' },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description:
              '에어코리아 dataTime 기준(KST). 서버 시각이 아니다 — 발표 지연으로 최대 1시간 과거일 수 있다.',
          },
          stationFallback: { $ref: '#/components/schemas/StationFallback' },
          serviceStatus:   { $ref: '#/components/schemas/ServiceStatus' },
          current: {
            type: 'object',
            description: 'hourlyForecast[0]과 같은 값이다.',
            properties: {
              airQuality:   { $ref: '#/components/schemas/AirQualityMetrics' },
              weather:      { $ref: '#/components/schemas/WeatherInfo' },
              runningIndex: { $ref: '#/components/schemas/RunningIndex' },
            },
          },
          hourlyForecast: {
            type: 'array',
            description: '지금부터 24시간. [0]이 현재 시각 바다.',
            minItems: 24,
            maxItems: 24,
            items: { $ref: '#/components/schemas/HourlyForecast' },
          },
          bestRunningHours: {
            type: 'array',
            description:
              '점수 60 이상 상위 3개. **점수 내림차순**(오늘 구간 → 내일 구간)이며 이 순서가 계약이다. 현재 시각은 제외된다.',
            maxItems: 3,
            items: { $ref: '#/components/schemas/BestRunningHour' },
          },
        },
      },
    },
  },
}
