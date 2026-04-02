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
    "ver": "1.0"
  }
  ```
