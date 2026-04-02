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
            description: '대기질 및 러닝 지수',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AirQualityResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
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
            description: '지역 ID',
            schema: { type: 'string', example: 'seoul-gangnam' },
          },
        ],
        responses: {
          200: {
            description: '대기질 및 러닝 지수',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AirQualityResponse' },
              },
            },
          },
          404: {
            description: '지역 없음',
            content: {
              'application/json': {
                example: { error: '지역을 찾을 수 없습니다.' },
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
        properties: {
          pm25: { type: 'number', description: '초미세먼지 μg/m³', example: 28 },
          pm10: { type: 'number', description: '미세먼지 μg/m³',   example: 45 },
          o3:   { type: 'number', description: '오존 ppm',          example: 0.032 },
          no2:  { type: 'number', description: '이산화질소 ppm',    example: 0.018 },
          co:   { type: 'number', description: '일산화탄소 ppm',    example: 0.6 },
        },
      },
      RunningIndex: {
        type: 'object',
        properties: {
          score:   { type: 'integer', minimum: 0, maximum: 100, example: 72 },
          status:  { type: 'string', enum: ['great', 'good', 'caution', 'bad', 'worst'], example: 'good' },
          label:   { type: 'string', example: '달리기 좋음' },
          message: { type: 'string', example: '달리기에 좋은 환경입니다.' },
          canRun:  { type: 'boolean', example: true },
        },
      },
      HourlyForecast: {
        type: 'object',
        properties: {
          hour:         { type: 'integer', minimum: 0, maximum: 23, example: 6 },
          airQuality:   { $ref: '#/components/schemas/AirQualityMetrics' },
          runningIndex: { $ref: '#/components/schemas/RunningIndex' },
        },
      },
      AirQualityResponse: {
        type: 'object',
        properties: {
          regionName:          { type: 'string', example: '서울 강남구' },
          updatedAt:           { type: 'string', format: 'date-time' },
          currentAirQuality:   { $ref: '#/components/schemas/AirQualityMetrics' },
          currentRunningIndex: { $ref: '#/components/schemas/RunningIndex' },
          hourlyForecast: {
            type: 'array',
            items: { $ref: '#/components/schemas/HourlyForecast' },
          },
          bestRunningHours: {
            type: 'array',
            items: { type: 'integer' },
            example: [6, 7, 21],
          },
        },
      },
    },
  },
}
