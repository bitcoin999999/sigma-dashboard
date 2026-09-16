> 출처: Claude Code auto-memory `project_sigma_dashboard.md` — 마지막 갱신 **2026-08-23**, 2026-08-25 이관.
> 특정 시점의 관찰 기록이다. 코드와 어긋날 수 있으니 사실로 단정하기 전에 현재 코드를 확인할 것.

사용자가 "홈페이지"라고 지칭하면 `~/projects/sigma-dashboard`를 뜻한다. 사이트 제목은 **1SIGMA · Market Range Monitor**로, [[project_oi_shock]]의 주간 1σ 밴드를 웹으로 보여주는 대시보드다(75종목, 금요일 종가 앵커 기준 밴드 소진율).

Vercel 팀 `centme-9969`, 프로젝트명 `sigma-dashboard`에 배포돼 있다.

**방문자 데이터는 2026-08-23 이전이 존재하지 않는다.** 그날까지 애널리틱스가 아예 붙어 있지 않았고(`@vercel/analytics`·GA·Plausible 전부 없음), 그날 `@vercel/analytics` v2를 루트 레이아웃에 추가했다.

**Why:** 사용자가 일 방문자수를 물었을 때 수집 자체가 없어서 답할 수 없었고, 소급 복원도 불가능했다.

**How to apply:** 트래픽·방문자 질문이 오면 2026-08-23 이후 구간만 유효하다고 전제할 것. 그 이전을 물으면 데이터 없음을 먼저 알릴 것. 단, Vercel 대시보드 **Observability**의 엣지 요청 수는 패키지와 무관하게 그 이전에도 남아 있으나 봇·정적자산 포함이라 방문자수와 다른 지표다.

**주의:** Vercel Web Analytics는 코드 추가만으로는 켜지지 않고 프로젝트 설정에서 별도 활성화가 필요하다. 수치가 0이면 이 토글부터 확인할 것.


## 2026-09-08 일정 패널 디자인 검토 — 현재 코드/조회 관찰

아래는 관찰과 개선 제안의 근거이며, 구현 또는 사용자 확정 규칙이 아니다.

- `lib/econ-calendar.ts`는 날짜별 macro/earnings 조회 실패를 빈 배열로 바꾸고, `partial`은 캐시 TTL(정상 10분/부분 실패 30초)에만 사용한다. 날짜별 조회 성공 여부가 UI로 전달되지 않아 조회 실패도 `No scheduled prints`로 보일 수 있다. 전체 실패 시 이전 memo를 반환할 수 있지만 마지막 성공 조회 시각도 UI에 없다.
- `components/dashboard/dashboard.tsx`의 Refresh quotes는 `/api/snapshot`만 갱신한다. 캘린더는 서버 페이지 렌더 시 전달되는 prop이며 현재 컴포넌트에 자동 갱신 경로가 없다. 서버 TTL 만료는 열린 화면의 자동 갱신을 의미하지 않는다.
- actual null만으로 미발표를 확정할 수 없다. 예정 시각 경과 후 값 미수신, 숫자 actual이 원래 없는 연설/성명도 고려해야 한다. 시각 경과를 발표 확인으로 취급하지 말 것.
- 현재 중복 제거는 소문자화한 이름+원본 시각으로 수행한다. Core PCE와 headline PCE는 별도 시리즈이므로 유사 이름이라는 이유로 합치거나 삭제하지 말 것. BEA 정의: https://www.bea.gov/index.php/help/faq/518
- 2026-09-08 Nasdaq 공개 earnings API를 date=2026-08-31~2026-09-04로 조회: 일별 총건수 9/15/29/41/4, time-not-supplied 9/14/29/38/4. 총 98건 중 94건(95.9%). 전체 종목의 과거 시점 조회 표본이며 관심 종목만의 비율 또는 당시 발표 전 미상 비율은 미검증. 이 5일 응답에는 SMTC가 없었다. 현재 배포 화면 Sep 7~11 실적은 ADBE/ORCL 2건 모두 After였다.
- 디자인 권고(미구현): 미상 세션 칩은 티커만 표시하고 상세/접근성 이름에 세션 미제공을 보존. 데스크톱 주간 5칼럼 유지, 상태를 명시하고 동일 시각의 지표를 묶기. 승인된 표시 형식 변경으로 해석하지 말 것.


## 2026-09-08 일정 패널 개선 구현 (로컬, 미배포)

사용자가 위 디자인 검토를 바탕으로 코드 수정을 요청해 반영했다.
- `calendar-state.ts`가 ET 시각 변환·발표 상태·다음 핵심 일정 선택·실패 시 자료 보존의 단일 출처다. actual null을 완료로 판단하지 않는다. 연설/성명은 시각 경과만 표시한다.
- 매크로/실적 피드마다 성공 조회 시각과 실패 여부를 보존한다. 유효한 빈 배열과 data/rows 누락 응답을 구별한다. 실패 시 이전 자료가 있으면 유지하되 실패 표시와 원래 자료 시각을 남긴다.
- `/api/calendar?anchor=...`와 패널의 일정 확인 버튼을 추가했다. 화면이 보일 때 60초마다 서버에 확인하고, 서버 TTL은 기존 정상 10분/부분 실패 30초를 유지한다. 15초마다 현재 시각 기준의 발표 상태를 재평가한다. 밴드 앵커가 달라졌으면 409로 페이지 재로딩을 안내한다.
- 1180px 이상은 5칼럼/실적 행 정렬, 좁은 화면은 요일 접기. 다음 핵심 요약, KST 우선 시간, 오늘 역상 배지, 실제/예상 인접 표시, 공통 이전값 토글. UNKNOWN 세션은 칩에서 생략하고 종목 상세에서 세션 미제공을 표시한다.
- tier 화이트리스트·일 5건 제한·벤더 날짜 보정·1σ 산식은 유지했다. 서프라이즈 파싱/방향 색상은 넣지 않았다.
- 2026-09-08 로컬 확인 중 벤더 매크로 응답이 월/화에 같은 NY Fed 지표를 보여주는 사례가 있었고, 월요일 실적은 rows 미제공으로 실패 처리됐다. 기존 날짜 보정 또는 벤더 데이터의 정합성 문제인지 미검증이며, 디자인 작업에서 임의로 날짜를 수정하지 않았다.
- `node --test tests/calendar.test.mjs`로 6개 테스트, ESLint/TypeScript/프로덕션 빌드 통과. 데스크톱 1440px·모바일 390px 및 라이트/다크 화면, 실적 상세 연결, 이전값 토글/요일 접기를 확인했다. 디자인 탐색 속도의 개선 효과는 별도 사용자 측정 전이므로 미검증이다.


### 2026-09-08 사용자 확정: 일정 UI 영어 표기

일정 패널과 실적 상세의 모든 사용자 표시 문구(제목, 상태, 버튼, 오류, 접근성 이름, 요일/날짜)를 영어로 통일한다. 한국어로 되돌리지 말 것. 대화·운영 문서는 계속 한국어. 이번 변경은 문구만 바꾸며 일정 갱신 주기(가시 화면 1분 확인 / 서버 정상 캐시 10분 / 부분 실패 30초)는 유지한다. 오전 7시 KST 시그마 발행 잡과 일정 조회는 별개다.


### 2026-09-09 사용자 확정: 벤더 No record found는 일정 없음

사용자가 명시적으로 일정 없음 표시 및 운영 배포를 요청했다. Nasdaq의 rCode=200, bCodeMessage code=1002 및 No record found 메시지가 확인되는 응답은 정상 빈 배열로 처리하며 `No scheduled events`를 표시한다. 과거의 모든 data:null 실패 처리 지침보다 이 사용자 결정이 우선한다. 원인 불명의 null, HTTP 오류, 타임아웃은 여전히 조회 실패로 구분한다. 정상 빈 응답은 이전 자료를 대체하고 정상 TTL 10분을 적용한다.

2026-09-09 운영 배포 완료: `dpl_38Wmb4HD4nnbtNYtWVrWc6xL224c`, https://sigma-dashboard-five.vercel.app. 영어 일정 UI/자동 확인/명시적 No record found 정상 빈 일정 처리를 함께 배포했다. 테스트 7개·린트·로컬 및 Vercel 빌드 통과. 운영 화면에서 `No scheduled events`와 영어 UI를 확인했다. 위의 미배포 표기는 당시 상태이며 이 배포로 대체된다.


## 2026-09-10 사용자 확정: 한국어·영어 전역 UI (운영 배포 완료)

- 홈페이지 전체를 한국어/영어 2개 언어로 제공한다. 한국 접속자의 최초 기본은 한국어이고, 한국·미국 국기 버튼으로 전환한다.
- 사용자가 선택한 언어는 `sigma-locale` 쿠키에 1년간 저장하며, 저장된 선택이 접속 국가와 브라우저 언어보다 우선한다. 최초 판별은 Vercel `x-vercel-ip-country=KR`, 로컬 환경은 `Accept-Language: ko` 순서로 한국어를 선택한다.
- 한국어 UI에서도 1σ, GEX, gamma, implied volatility, expected move, overheated/oversold 등 실제 판독에 쓰는 전문용어는 억지로 번역하지 않는다. 설명·버튼·상태·접근성 문구 위주로 번역한다.
- 기존 가이드 전용 localStorage 언어 토글은 전역 언어 설정으로 통합했다. 메타데이터·JSON-LD·`html lang`도 요청 언어를 따른다.
- 새 언어 선택 테스트 2개를 추가했고 기존 일정 테스트 7개와 함께 통과했다.
- 2026-09-10 운영 배포 완료: `https://sigma-dashboard-c42ey99ya-svpk1.vercel.app`, 대표 주소 `https://sigma-dashboard-five.vercel.app`. 운영 주소에서 한국어·영어 요청 모두 HTTP 200과 확정 문구 노출을 확인했다.
- 사용자가 메인 헤드라인을 한국어 **"각 종목의 이번주 예상 주가 범위와 현재 위치"**, 영어 **"Each stock’s expected price range this week and current position"**으로 확정했다.


### 2026-09-10 사용자 확정: PPI actual BLS fallback (운영 배포 완료)

- Nasdaq 경제일정 피드가 발표 후에도 PPI/Core PPI의 actual을 `&nbsp;`로 반환하는 지연을 확인했다. 같은 시각 BLS 공식 API에는 최신월 지수가 반영돼 있었다.
- Nasdaq actual이 비어 있고 발표 시각이 지난 당일 PPI/Core PPI에만 BLS 공식 시계열 fallback을 적용한다. Nasdaq 값이 있으면 절대 덮어쓰지 않는다.
- 사용 시계열은 계절조정 Final demand `WPSFD4`와 Final demand less foods and energy `WPSFD49104`다. 전월 대비 actual 산식은 `lib/bls-ppi.ts` 한 곳에만 둔다.
- 최신 BLS 관측월이 발표 대상월(발표월의 직전 달)과 일치하고 `latest=true`일 때만 사용한다. 따라서 발표 전의 지난달 값을 오늘 actual로 오인하지 않는다.
- 2026-09-10 실데이터 기준 PPI `(157.411 / 156.784 - 1) = 0.4%`, Core PPI `(154.842 / 154.592 - 1) = 0.2%`를 확인했다. 테스트 12개, ESLint, TypeScript, 프로덕션 빌드가 통과했다.
- 2026-09-10 운영 배포 완료: `https://sigma-dashboard-i9fl4pjhs-svpk1.vercel.app`, 대표 주소 `https://sigma-dashboard-five.vercel.app`. 운영 `/api/calendar`에서 두 값 모두 `actualSource: "bls"`로 반환되는 것을 확인했다.


### 2026-09-11 사용자 확정: 국기 선택에 따른 일정 시간대 (운영 배포 완료)

- 한국 국기(ko)는 일정 날짜·요일·오늘 표시·주요 일정 요약·확인 시각을 Asia/Seoul(KST), 미국 국기(en)는 America/New_York(ET) 기준으로 표시한다. 기존의 모든 날짜 ET 고정 표기를 대체한다.
- 시각이 있는 macro는 같은 실제 발표 순간을 선택 시간대로 변환해 일자별로 다시 묶는다. 미국 금요일 오후 일정이 한국 토요일로 넘어가면 토요일 열도 표시한다. 원천 ET 날짜와 발표 상태 계산은 바꾸지 않는다.
- 실적 PRE는 한국 같은 날짜, AFTER는 다음 날짜에 배치한다. 정확한 발표 시각은 생성하지 않는다. UNKNOWN 실적·시각 미제공 macro는 한국 날짜를 임의 추정하지 않고 원본 ET 날짜를 명시한다. 실적 상세에도 같은 변환 함수를 사용한다.
- 조회 실패 상태·마지막 성공 시각은 원본 ET 피드 날짜를 유지한다. 한국 날짜에 겹치는 이전 ET 날짜의 실패도 숨기지 않는다. 최초 화면 뒤 즉시 현재 시각에 맞춰 캐시 시각 때문에 오늘 표시가 뒤처지지 않게 했다.
- 화면 60초 확인/15초 시각 갱신, 서버 정상 10분/부분 실패 30초, ET 일자당 macro 선별 5건은 유지한다. 이전 리뷰의 별도 피드·산식 문제는 이번 수정 범위에 포함하지 않았다.
- 테스트 20개 통과(사진 시각 2026-09-11 09:04 KST/전일 20:04 ET의 화면 렌더링 포함), 변경 파일 린트·타입 검사 통과. 로컬 Turbopack은 환경의 포트 바인딩 제한으로 실패하여 공식 Webpack 경로의 프로덕션 빌드로 통과했다.
- 2026-09-11 09:17 KST 운영 배포 완료: `https://sigma-dashboard-gja1b2yei-svpk1.vercel.app`, 대표 주소 `https://sigma-dashboard-five.vercel.app`. Vercel의 Turbopack 프로덕션 빌드도 통과했다.
- 대표 주소에 locale 쿠키를 각각 넣어 HTTP 200과 서버 렌더링을 검증했다. ko는 `금 9/11 · 오늘 · KST`와 ADBE/ORCL의 9/11 배치, en은 `Thu 9/10 · Today · ET`와 두 실적의 9/10 배치를 확인했다. Mac 잠금 때문에 배포 후 브라우저 시각 검사는 수행하지 못했다.
- 추가 API·유료 서비스 도입은 없다. 기존 Vercel 요금제와 사용량 정책을 그대로 사용한다.

### 2026-09-11 다음 주 일정 전환 (운영 배포 완료)

- 캘린더 헤더에 `다음 주 보기 / 이번 주 보기` 버튼을 추가했다. 영어는 `View next week / View this week`. 제목·날짜·주요 일정·실적·자동 확인 대상이 선택한 주를 따른다.
- `/api/calendar?week=0|1`로 밴드 앵커 기준 이번 주/다음 주를 조회한다. 다른 값은 400, 기존 밴드 앵커 불일치는 409다. 주식 밴드·수치는 변경하지 않는다.
- 정상 응답을 받은 뒤에만 화면과 선택 주를 함께 바꾸며, 요청 중 버튼을 잠그고 취소된 응답은 무시한다. 실패 시 기존 주와 자료를 유지한다.
- 서버 캐시는 앵커·주·추적 종목별로 분리하고 최대 8개로 제한한다. 기존 정상 10분/부분 실패 30초 TTL과 KST/ET 일자 재배치는 유지한다.
- 두 피드의 7일 이동, 주별 캐시 분리, 연도 경계와 한영 버튼 렌더링을 검증했다. 전체 테스트 21개, 변경 파일 lint, TypeScript 및 로컬 Webpack 빌드 통과. 전체 lint는 기존 `docs/reviews/2026-09-10/reproduce.cjs`의 require 스타일 오류 8개로 실패했다.
- 사용자 요청으로 프로덕션 배포: `dpl_DU1CZA7qCYLAfjtQgFR37wogkS2U`, `https://sigma-dashboard-1fcqjitwg-svpk1.vercel.app`. Vercel 빌드 통과, 대표 주소 `https://sigma-dashboard-five.vercel.app` 연결 완료.
- 운영 API 검증: week=0은 9/7~9/11(매크로 8건), week=1은 9/14~9/18(매크로 6건), 모두 HTTP 200·macroErrors 0. 한영 홈페이지 모두 HTTP 200과 `다음 주 보기 / View next week` 버튼 노출을 확인했다.

### 2026-09-11 15:39 KST CPI 일정 누락 진단 (미수정)

- 운영 week=0은 9/7~9/11로 정상이나 9/11 events=[]·macroStatus=ok로 반환됐다. Nasdaq economicevents?date=2026-09-12 원본은 HTTP 200·rows 3개·United States 0개였다. 인접 date=2026-09-11에는 전날 PPI가 남아 있어 임의로 날짜 보정을 되돌리지 않았다.
- BLS 공식 9월 일정에는 9/11 08:30 ET(21:30 KST) CPI 발표가 존재한다: https://www.bls.gov/schedule/2026/09_sched_list.htm. 이번 조회에서 Nasdaq이 이를 누락한 이유 자체는 확인되지 않았다.
- loadEconDay는 조회 성공 후 미국 행이 없으면 정상 빈 배열로 반환하고 retainCalendar는 error에서만 과거 자료를 보존한다. 따라서 벤더가 정상 응답으로 일정을 누락하면 과거 CPI 행을 대체하고 keySchedule은 주요 일정 없음으로 표시한다. 단순 HTTP 성공은 일정 완전성을 보장하지 않는다.
- 현재 BLS fallback은 이미 존재하는 발표 당일 PPI/Core PPI 행의 actual만 채운다. CPI와 일정 행 자체의 누락에는 동작하지 않는다. 공식 일정 보완 및 정상 응답의 갑작스러운 누락 감지가 필요하나 이번 요청에서는 진단만 수행했다.

## 2026-09-15 Blob 한도 초과 장애 — 긴급 복구 배포

- 운영 `/api/snapshot`이 503, Blob 공개 URL이 403 `Your store is blocked`를 반환했다. Vercel 저장소 API에서 `usageQuotaExceeded=true`, `billingState=suspended`, `status=limits-exceeded-suspended`를 확인했다. 어떤 사용량 항목이 초과했는지는 미확인이다. 저장 크기는 987,612바이트, 파일은 1개였다.
- 당일 07:06:40 KST Blob 업로드는 성공했다. **업로드 성공이 공개 읽기 성공을 보장하지 않는다.** 발행 로그의 완료만으로 서비스 정상이라고 판단하지 말고 공개 읽기/API까지 검사해야 한다.
- `oi_shock/state/dashboard_snapshot.json`의 원본을 `data/emergency-snapshot.json`에 만료시각을 붙여 별도로 배포했다. 개발용 `data/snapshot.json`은 쓰지 않는다. 정확히 403 + 위 차단 본문일 때만 긴급 원본을 읽으며, 일반 403/404/500 및 데이터 검증 오류를 숨기지 않는다.
- **긴급 복구본 만료: 2026-09-16 07:15 KST.** 생성시각·세션·가격을 원본 그대로 보존하며, 만료 이후에는 거부한다. 자동 갱신 문제의 영구 해결은 아직 끝나지 않았다. 사용자는 무료 파일 배포 대안과 Pro 전환 중 선택 전이며, Pro 비용을 질문했다(공식 월 $20 + 세금, 사용량 초과 추가 가능). 결제/요금제 변경은 수행하지 않았다.
- 배포 `dpl_FHps49GDs2eddFJos2hCuNwrg1Kf`, https://sigma-dashboard-6n03a58a9-svpk1.vercel.app → 대표 주소 연결. 전체 테스트 24개·변경 파일 lint·TypeScript·로컬 Webpack 및 운영 Turbopack 빌드 통과. 운영 API/홈 HTTP 200, 브라우저 한국어 화면에서 96종목·9/14 close 확인. API의 96종목과 11섹터 배열이 로컬 원본과 모두 일치했다.

### 2026-09-15 사용자 확정: 무료 정적 데이터 배포로 영구 전환 완료

- 사용자가 Pro 비용·무료 방식의 단점을 확인한 뒤 **추가 결제 없는 파일 배포**를 선택했다. Vercel 요금제/결제 설정은 변경하지 않았다.
- 데이터 전용 프로젝트 `svpk1/sigma-snapshot-data` (`prj_2nwmAeRvxdEtaS7zcV8VBwA3KppD`)를 사용한다. 고정 공개 URL은 https://sigma-snapshot-data.vercel.app/snapshot/latest.json 이다. 운영 `SNAPSHOT_SOURCE=http`, `SNAPSHOT_URL`을 이 주소로 설정했다. Blob 환경변수는 남아 있지만 사용하지 않는다.
- `httpSource`가 기존 스키마 검사·8초 제한·앱 no-store 정책을 적용한다. 원본 날짜/가격/산식/배열을 바꾸지 않는다. 긴급 파일·만료 로직은 제거했다. 따라서 위 **9/16 07:15 임시 만료 제한은 더 이상 적용되지 않는다.**
- `oi_shock/tools/publish_snapshot.sh`가 생성 후 `publish_static_snapshot.py`로 넘긴다. 매번 임시 디렉터리에 JSON/robots/vercel 설정/프로젝트 연결만 배치하므로 홈페이지 수정 중 코드나 비밀파일이 자동 배포되지 않는다. 생성 소스·1σ 산식·커버리지 80%·화~토 07:00 KST 스케줄은 유지한다.
- 배포할 고정 사본에 기존 `check_snapshot.py`를 적용하고, 배포 READY 뒤 공개 JSON 전체와 홈페이지 API의 발행시각/세션/앵커/경과일/종목·섹터 배열이 원본과 일치해야 성공이다. 불일치/HTTP 오류는 고정 URL로 10초 간격 최대 10회 검증하며 실패 시 잡이 비정상 종료한다.
- CLI 59.1.4는 agent/non-interactive에서 `{status, deployment}`로, 일반 launchd 환경에서는 배포 객체 자체를 출력했다. 첫 무인환경 검증에서 배포는 성공했지만 parser가 실패했다. 두 형태 모두 검사하고 `--non-interactive`도 명시해 수정했다.
- 홈페이지 운영 배포 `dpl_AZdWWnfnva13SHpcbDFYUoVLTGDj`, https://sigma-dashboard-j3v6jvyte-svpk1.vercel.app → 기존 대표 주소 연결. 앱 테스트 23개·발행기 테스트 8개(총31개), 변경 파일 lint/타입 검사, 로컬/운영 빌드 통과.
- **17:08:06~17:08:16 KST**, 설치된 launchd plist의 환경변수/실행명령/작업폴더로 `--no-generate --no-notify` 실행: 종료0, 10.25초, 96종목+11섹터 공개 파일/홈 API 모두 일치. 새 데이터 배포 https://sigma-snapshot-data-es8qsvzk7-svpk1.vercel.app. 데이터 재수집과 알림은 생략했으며 기존 상태 JSON은 수정하지 않았다.
- 설치·로드된 잡은 계속 화~토07:00 KST. 07:00은 **수집 시작 시각**이며 최근 생성 약6분 + 이번 배포검증10초 기준 화면 반영07:06~08 예상(미래 실행시간 보장 아님). 기존처럼 Mac/네트워크가 동작해야 한다. 내일 실스케줄 실행 자체는 아직 미래이므로 미검증이다.

### 2026-09-15 후속 검토: 반복 다운로드 감축·조기 발행

- 위 이관 직후 사용자가 05:35 시작을 요청하여 최종 스케줄을 **화~금 EDT05:35 / EST06:35,
  토07:00**으로 변경했다. 평일07:00 종가 대조 후 값이 바뀐 경우에만 정정 발행한다.
- `/api/calendar`가 60초마다 987,612B 시장 파일을 읽던 경로를 같은 배포의736B
  `calendar-context.json`으로 바꿨다. 해당 다운로드 바이트99.925% 감소이며 전체 트래픽 절감률과 다르다.
- 기존 ko/en 날짜·시간대, 주 전환, 60초 폴링, 정상10분/부분30초 TTL은 유지했다.
  웹26개 검사·lint·tsc·운영 빌드 통과. 최종 배포 `sigma-dashboard-jda5iumsu-svpk1.vercel.app`.
- 운영 홈/종목 상세/가격API200,96종목+11섹터 원본 일치, 두 주 일정200,
  잘못된 week400/앵커409 확인. Nasdaq이 HTTP200으로 일부 일정을 누락하는 기존 한계는 남아 있다.
- Blob 팀 기능 차단 시각11:34:33 KST, 파일1개/987,612B 확인. **세부 사용량 항목·수치는 아직 미확인**.
  반복 읽기/전송이 유력하지만 방문자수나 전송량을 실측한 것처럼 보고하지 말 것.
- [전체 운영 검토·비용·UW 근거](../../../oi_shock/docs/agent-context/snapshot-operations-20260915.md).


### 2026-09-16 종목 상세 주간 30분봉

- 사용자 요청으로 `/symbol/[symbol]`의 PC 오른쪽에 이번 주 월~금 30분 OHLC 차트를 추가했다. 모바일은 요약 아래다. 대문 벤치마크와 티커 패널은 유지한다.
- 상세 페이지에서만 Yahoo Finance 피드를 읽으며 기존 스냅샷·1σ 산식·발행 잡은 수정하지 않는다. 휴장/미래 구간은 빈칸, 실제 고가/저가로 축을 자동 조정한다.
- 주간 선택·피드 차이·실패 처리·검증 기록은 [weekly-chart.md](weekly-chart.md)를 참고한다.

- 2026-09-16 후속 요청으로 자동 조회를 장중 30분 간격으로 줄이고, 브라우저/CDN 공유 캐시와 해당 주 ±1σ 가격선을 추가했다. 최초 1분 정책은 폐기한다. 배포·캐시 HIT·가격/축 검증은 [weekly-chart.md](weekly-chart.md)에 기록했다. 운영 배포는 `dpl_3KhghmBvxUkaCk4nwQfokeFKpZ9R`이다.
