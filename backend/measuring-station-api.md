# 측정 관련 Open API

## 측정소 정보

End Point : https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc

### 근접측정소 목록 조회

TM 좌표를 입력하여 입력된 좌표 주변 측정소 정보와 입력 좌표와의 거리 조회 기능 제공

- /getNearbyMsrstnList
- 요청변수(Request Parameter)
  ```json
  {
    "serviceKey": "", // 인증키(URL Encode)
    "returnType": "json",
    "tmX": 244148.546388, // TM측정방식 X좌표
    "tmY": 412423.75772, // TM측정방식 Y좌표
    "ver": "1.1"
  }
  ```

### TM 기준좌표 조회

TM 좌표를 알 수 없는 사용자를 위해 읍면동 이름으로 검색하여 TM기준좌표 내역을 조회하는 기능 제공

- /getTMStdrCrdnt
- 요청변수(Request Parameter)
  ```json
  {
    "serviceKey": "", // 인증키(URL Encode)
    "returnType": "json",
    "numOfRows": 100, // 한 페이지 결과 수
    "pageNo": 1, // 페이지 번호
    "umdName": "" // 읍면동명
  }
  ```
- `totalCount`가 `items.length`보다 크면 2페이지 이후가 잘린 것이다. 코드는 이 경우 경고를
  남긴다 — 동명이 흔한 검색어에서 사용자가 찾는 지역이 조용히 빠지는 것을 감지하기 위함.

## 대기 오염 정보

End Point : https://apis.data.go.kr/B552584/ArpltnInforInqireSvc

### 측정소별 실시간 측정정보 조회

측정소명과 측정데이터 기간(일,한달,3개월)으로 해당 측정소의 일반항목 측정정보를 제공하는 측정소별 실시간 측정정보 조회

- /getMsrstnAcctoRltmMesureDnsty
- 요청변수(Request Parameter)

  ```json
  {
    "serviceKey": "", // 인증키(URL Encode)
    "returnType": "json",
    "numOfRows": 100, // 한 페이지 결과 수
    "pageNo": 1, // 페이지 번호
    "stationName": "", // 측정소 이름
    "dataTerm": "DAILY", // 요청 데이터기간(1일: DAILY, 1개월: MONTH, 3개월: 3MONTH)
    "ver": "1.3" // 아래 주의사항 참고
  }
  ```

#### `ver`를 1.3으로 쓰는 이유 (중요)

`ver`는 응답에 포함되는 **항목 집합**을 정한다. 1.0으로 요청하면 `pm25Value`(초미세먼지)가
응답에 **포함되지 않는다**. 그러면 다음 연쇄가 일어난다.

1. `parseMeasurement`가 없는 필드를 결측으로 읽어 `pm25: null`
2. `isMeasurementFaulty`가 모든 후보 측정소를 비정상으로 판정 → 폴백을 다 소진
3. `getRunningIndex`가 PM2.5 결측을 이유로 전 시간대 `status: 'unknown'`, `score: 0` 반환

즉 **호출은 성공하고 상류 에러도 없는데 화면 전체가 "측정 불가"가 된다.** 로그에는
`[air] ... 측정소 데이터 비정상 (PM2.5 또는 PM10 결측)`만 남아 원인이 드러나지 않는다.

1.3은 1.0의 항목을 모두 포함하는 상위집합(+ PM2.5 + 등급 항목)이므로 바꿔도 잃는 필드가 없다.
`airKoreaClient.ts`의 `warnIfFieldAbsent`가 응답에 키가 **아예 없는** 경우(요청 `ver` 문제)와
값이 `'-'`인 경우(측정소 결측)를 구분해 전자에는 error 로그를 남긴다.

## 공통 응답 규격 — 성공만 가정하면 안 된다

게이트웨이는 서비스키 미등록·일일 한도 초과·서비스 점검 시 `returnType=json`을 요청했더라도
**HTTP 200에 XML 에러 봉투**를 돌려준다.

```xml
<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
    <returnReasonCode>22</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>
```

`res.ok`는 통과하므로 `res.json()`이 SyntaxError를 던지거나, JSON 모양이면서 `response` 키가
없어 `json.response.header`가 TypeError를 던진다. 같은 코드가 `response.header.resultCode`로도
올 수 있다.

| returnReasonCode / resultCode | 의미 | 처리 |
|---|---|---|
| `03` | NODATA — 해당 시각 자료 미발표 | 직전 발표분으로 재시도 → 503 |
| `20` `30` `31` `32` `33` | 서비스키 문제 | 500 (재시도 무의미) |
| `22` | 호출 한도 초과 | 429 (KST 자정 리셋, 재시도 무의미) |
| `01` `04` `05` | 상류 장애·점검 | 502 (1회 재시도) |

분류와 파싱은 `backend/src/infrastructure/apiClients/openApiResponse.ts`가 담당하고,
`openApiResponse.test.ts`가 각 봉투에 대한 분류를 고정한다.

### 서비스키

포털이 주는 **인코딩 키**와 **디코딩 키** 중 **디코딩 키**를 `AIR_KOREA_API_KEY`에 넣는다.
코드가 `URLSearchParams`로 쿼리를 만들므로 값을 한 번 인코딩한다 — 이미 인코딩된 키를 넣으면
`%`가 `%25`로 이중 인코딩되어 모든 호출이 `SERVICE_KEY_IS_NOT_REGISTERED`를 받는다.
이 경우는 시간이 지나도 회복되지 않으므로 한도 초과와 구분된다.
