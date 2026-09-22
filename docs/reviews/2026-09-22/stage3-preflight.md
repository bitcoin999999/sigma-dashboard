# 3단계 수정 전 점검과 기능 설계

점검: 2026-09-22 KST. 기준 SHA `2a0db4f93ea89ce7fe068c72738786bcf249f164`.

사용자의 “먼저 코드를 수정하지 말고 보고” 지시에 따라 앱·데이터 생성 코드는 수정하지 않았다. 배포, push, PR 생성, 상태 파일 변경도 하지 않았다. 이 문서는 구현 완료 보고가 아니다. 마지막 요청에 따라 **종목별 주가·당시 σ 이력과 포트폴리오를 이번 범위에 포함**한다. 앞선 제안서의 “포트폴리오는 4단계”는 더 이상 적용하지 않는다.

## 1. 저장소와 배포 동기화

| 대상 | 확인 결과 |
|---|---|
| 실제 원본 `~/projects/sigma-dashboard` | `main`, `2a0db4f`, 작업 트리 깨끗함 |
| 공개 GitHub `origin/main` | `git fetch origin` 후 같은 전체 SHA. ahead 0 / behind 0 |
| 운영 Vercel | `dpl_CXgkgEWPvedgUkPgFghfNMq9Pgur`, production / READY |
| 운영 배포 커밋 | API `meta.githubCommitSha`가 같은 전체 SHA |
| 배포 방법 | `source=cli`, `gitSource=null`, `githubCommitRef=main` |
| 운영 배포 시각 | 2026-09-22 06:33:45 KST |
| 작업 폴더 최상위 | 커밋 없는 `main`, remote 없음, 파일 전체가 untracked인 이전 복사본 |
| `sector-expansion` | `codex/sector-expansion`, 같은 SHA, 점검 시작 시 깨끗함 |
| `mobile-stage1` | `codex/mobile-stage1`, `8ec85aa`, 사용자 문서 변경과 untracked 리뷰 폴더 존재 |

**동기화 선행 조건은 충족했다.** 공개 main이 `64fb1c9`에 멈췄다는 9/21 관찰은 현재 사실이 아니다. 그 커밋 이후 13개 커밋, 56개 파일, 2,717줄 추가 / 556줄 삭제가 반영돼 있다. 원격과 HEAD의 diff는 없다. Vercel SHA는 업로드 메타데이터의 일치이며 모든 배포 소스 파일을 역다운로드한 바이트 검사는 아니다.

`sector-expansion`의 origin은 GitHub가 아니라 로컬 원본 저장소다. 공개 원격 확인은 실제 원본에서 실행했다. 기존 사용자 변경은 reset/checkout/clean/stash하지 않았다. 새 기능은 최상위 이전 복사본이나 `mobile-stage1`에서 시작하지 말고 `2a0db4f` 기준 격리 브랜치에서 진행한다.

## 2. 앞 단계에서 실제 바뀐 파일과 미완료 항목

해당 기능들은 별도 “2단계 완료” 커밋이 아니라 `f65219f`에서 시작한 모바일 작업과 후속 커밋에 들어 있다. 파일 존재만으로 제안서의 모든 2단계 요구를 완료한 것으로 판정하지 않는다.

| 기능 | 주요 실제 변경 파일 |
|---|---|
| 독립 상세, 가격·σ, 기준일, 차트, GEX | `app/symbol/[symbol]/page.tsx`, `components/dashboard/weekly-price-chart.tsx`, `components/dashboard/gex-panel.tsx`, `lib/gex-chart-levels.ts` |
| 관심목록 공통 저장 | `lib/watchlist.ts`, `hooks/use-watchlist.ts`, `components/watchlist/watch-button.tsx`, `components/my-sigma/my-sigma-client.tsx` |
| 홈 개인 영역 | `components/watchlist/home-watchlist.tsx`, `components/dashboard/dashboard.tsx` |
| 링크 공유 | `lib/share.ts`, `components/share/symbol-share.tsx` |
| 목록 진입·복귀 | `lib/stock-navigation.ts`, `lib/board-navigation.ts`, `hooks/use-board-state.ts` |
| 모바일 카드·탐색 | `components/dashboard/stock-card.tsx`, `stock-table.tsx`, `stock-grid.tsx`, `components/layout/mobile-nav.tsx`, `nav-bar.tsx`, `ticker-search.tsx`, `app/globals.css` |
| 최근 분류 개편 | `lib/classification.ts`, `components/dashboard/classification-filters.tsx`, `lib/types.ts`, `lib/snapshot/types.ts` |

현재 남아 있는 항목:

- 최근 본 종목 저장 기능은 확인되지 않았다. 목록 필터·정렬·스크롤 복귀와 별개다.
- 관심목록 실제 한도는 20개지만 관심 버튼과 My Sigma 메타 설명은 아직 10개로 안내한다.
- 공유 목록을 열면 임시 목록으로 유지하지만 “저장”은 기존 목록 전체를 대체한다.
- 종목 이미지 공유, 종목별 OG, 관련 종목 링크는 없다.
- 사용자 정의 분석 이벤트는 없으며 루트의 기본 Vercel Analytics가 있다.

## 3. 현재 watchlist와 snapshot 구조

### 브라우저 저장

- 키: `sigma-personal-watchlist`.
- 형식: 버전 필드 없는 JSON 문자열 배열, 예: `["NVDA","TSLA"]`.
- 최대 20개. 대문자·공백·중복·허용문자 정규화. 현재 스냅샷에 없는 저장 종목도 유지한다.
- `useSyncExternalStore`로 SSR 준비 상태와 실제 저장값을 분리한다. `storage` 이벤트로 다른 탭의 변경을 반영한다.
- 쓰기 실패 시 이번 방문의 메모리에 유지하고 `persistent=false`를 표시한다.
- 손상 JSON은 빈 배열로 읽는다. 손상과 원래 빈 목록을 구분하는 상태는 없다.
- 공유 목록은 `?s=...`로 전달된다. **보유정보를 이 파라미터나 이 저장 배열에 추가하면 안 된다.**

### 공개 시장 데이터

운영 데이터는 Blob이 아니라 `https://sigma-snapshot-data.vercel.app/snapshot/latest.json` 정적 파일이다. 로컬 생성 원본, 공개 파일, 홈페이지 API의 quotes와 sectorQuotes가 모두 일치했다.

| 항목 | 실측 |
|---|---|
| 생성 시각 | `2026-09-22T05:42:35+09:00` |
| 가격 세션 | 2026-09-21 미국 정규장 종가 |
| 현재 앵커 | 2026-09-18 |
| 화면 밴드 기간 | 9/18–9/25 |
| 종목 | 일반 112 + 섹터 ETF 11 = 123 |
| 가격 이력 | 123종목 모두 최근 20거래일 |
| 직전 완료 주 밴드 | 110 / 123종목 |
| 지지난주 밴드 | 107 / 123종목 |
| 현재 양수·유한 σ 입력 | 123 / 123종목 |
| 원본 σ 캐시 | 최근 4개 앵커: 8/28, 9/4, 9/11, 9/18 |

주요 필드:

- 원본: `schemaVersion`, `generatedAt`, `band.anchorDate/sessionDate/elapsedDays/settled`, `quotes`, `sectorQuotes`.
- 종목: `price`, `previousClose`, `anchor`, `sigmaPercent`, `history[{date,close}]`, 선택적 `lastWeek`, `weekBeforeLast`, `gex`, `intraday`.
- 완료 주: `anchorDate`, `anchor`, `sigmaPercent`, `closes[{date,close}]`.
- 화면: `MarketSnapshot.generatedAt/sessionDate/bandAnchorDate/bandWindow/bandElapsed`.
- 아직 없는 필드: 불변 `snapshotId`, 명시적 `bandEnd`, 종목별 `methodVersion`, 가격 조정 정책, 밴드 최초 관측 시각.

원본 캐시에는 종목별 `scaled`, `from_anchor`가 있지만 종목 JSON에 실리지 않는다. 현재 공개 123종목 중 **26종목은 `from_anchor=false`, 8종목은 `scaled=true`**다. 상단 `band`의 공통 플래그만 보고 모든 종목의 산출 시점·입력 조건이 같다고 판단하면 안 된다. 시간 환산 자체가 잘못이라는 의미는 아니며, 비교 기준에 필요한 출처 메타데이터가 빠져 있다는 뜻이다.

`loadBoard()`의 React `cache()`는 한 요청 안에서 페이지와 메타데이터의 데이터를 맞춘다. 별도 HTTP 요청인 OG 이미지까지 같은 스냅샷을 보장하지는 않는다.

## 4. σ 계산과 상태 판정 정의

1σ 산출은 `oi_shock/sigma_core.py`가 유일한 출처다. 웹은 발행된 `sigmaPercent`를 사용해 가격 좌표를 변환한다. 새 화면에서 IV나 1.4745 환산을 다시 계산하지 않는다.

웹 단일 출처 `lib/sigma.ts`:

- `standardDeviation = anchor × sigmaPercent / 100`.
- `calculateZScore(price, anchor, standardDeviation)`.
- `resolveStatus(zScore)`: `≥ +1.5` OVERHEATED, `≥ +1` UPPER_1SIGMA, `≤ −1.5` OVERSOLD, `≤ −1` LOWER_1SIGMA, 그 외 NORMAL.
- 완료 주는 `buildWeeklyBand()`가 그 주 마지막 종가를 그 주 밴드로 평가한다.
- 기존 경계 근접은 NORMAL이면서 `|z| ≥ 0.85`. **0.8을 새로 도입하지 않는다.** 공통 상수·함수로 승격해 소비 화면들이 함께 쓴다.

My Sigma 요약 계약:

- 동일가중 `mean(z)`, `mean(abs(z))`; 평가액 가중치 없음.
- 범위 밖 개수는 유효 입력의 `resolveStatus(z) !== "NORMAL"`로 센다. 현재 서비스 관례상 정확한 ±1도 포함하며 문구·툴팁에 “경계 도달 포함”을 명시한다.
- 저장 종목 전체가 분모다. 누락 종목을 목록에서 제거하지 않고 `분석 가능 N / 전체 M`으로 표시한다.
- 유한한 z만으로 유효성을 판단하지 않는다. 원본 price/anchor/sigmaPercent의 양수·유한성과 데이터 출처도 검증한다.
- 같은 snapshot ID, 밴드 시작·끝, methodVersion, 가격 세션·관측 정책의 비교 가능성을 확인한다. 비교 불가면 평균을 숨기고 이유·분석 가능한 개수를 표시한다.
- 완전한 누락·빈 목록을 0으로 표시하지 않는다. `+2, −2 → 평균 0, 절대평균 2, 범위 밖 2`를 필수 회귀 케이스로 둔다.
- 이 값은 관심목록의 위치 요약이며 포트폴리오 수익률·변동성·포트폴리오 z-score가 아니다.

**재현된 결함:** `calculateZScore`는 표준편차가 falsy이면 0을 반환한다. NVDA의 `sigmaPercent`만 제거한 메모리 사본을 `buildStockData`에 넣으면 `zScore=0`, `status=NORMAL`이 된다. 운영 123종목에서 누락이 발견됐다는 뜻은 아니지만, 새 요약은 이 값을 정상 데이터로 받아서는 안 된다. 소비 화면 전체의 누락 표현을 먼저 정의한다.

## 5. 종목별 주가·σ 이력의 구체적 구성

### 하나의 시간축, 두 개의 패널

기존 30분봉·GEX를 유지하고 상세에 “주가와 주간 σ” 보기를 추가한다.

```text
NVDA  NVIDIA                     9/21 정규장 종가
$227.38  +2.30%                         +0.58σ

[주가·σ 이력] [이번 주 30분봉]
[1개월] [3개월] [1년] [전체]       자료가 있는 기간만 활성화

상단: 주가 선 + 각 주 ±1σ 가격 영역 + 주간 마감 표시
하단: 그 주 밴드로 계산한 σ 위치 + −1 / 0 / +1 기준선
      두 패널의 날짜 선택과 세로 커서를 동기화

선택한 주: 9/11 마감 −1.24σ · 하단 경계 밖
이후 1주: +1.82%  |  2주: 집계 전  |  4주: 집계 전
```

예시는 실제 저장 데이터다. NVDA는 9/11 종가 $218.29, 당시 z는 −1.241617이며 9/18 종가는 $222.27로 1주 가격 변화는 +1.823263%다. 이는 **한 사례의 관측 가격 변화**이며 “하단 이탈 후 반등 전략” 검증이 아니다.

표현 규칙:

- 위·아래 패널을 한 차트 영역으로 묶어 같은 날짜를 가리키게 한다. 가격 $와 σ의 독립 단위·기준선을 분명히 표시한다.
- 주간 마감 σ는 완료 주의 `buildWeeklyBand()` 결과다. 금요일에 새 주간 밴드로 바뀌며 표시되는 0σ를 직전 주 결산으로 쓰지 않는다.
- 주간 밴드는 계단형 영역으로 바뀐다. 리셋 지점을 세로 구분하고 σ 선을 이어 “복귀”처럼 보이게 만들지 않는다.
- 현재 진행 주는 “진행 중”으로 구분하며 최신 일일 종가로 갱신한다. 완료 주 점은 매주 확정한다.
- ±1 경계 도달은 `resolveStatus`로 표시하고, 상단/하단을 색뿐 아니라 ▲/▼와 문구로 구분한다.
- 날짜 선택 시 가격, 당시 앵커, 범위, σ, 관측일을 함께 보여준다. 모바일 터치 선택과 키보드 탐색도 제공한다.
- 이후 1/2/4주는 거래소 주간 마지막 세션으로 정의한다. 미래·누락 구간을 0%로 채우지 않는다. 연속 이탈은 “주별 마감”과 “새 진입”을 별개 필터로 둬 중복 사건을 숨기지 않는다.
- 당시 밴드가 없는 날짜는 가격만 표시한다. 오늘 IV로 과거 σ를 재구성하지 않는다.

### 먼저 추가할 이력 보관

현재 20거래일 가격 + 2주 밴드로 3개월/1년 그래프를 제공할 수 없다. `KEEP_WEEKS=4`를 무작정 늘리기보다 운영 캐시와 별개로 아래 데이터를 보관한다.

- 종목별 일일 종가 이력, 완료 주의 앵커·σ·종가, 실제 밴드 적용 기간.
- methodVersion, 원본 출처, 조정주가 여부, 최초 관측 시각, `scaled/fromAnchor`.
- 내용 해시 기반 snapshot ID와 정정 revision. 같은 날짜 재발행도 내용이 바뀌면 구분한다.
- 기존 일일 발행에서 이미 얻은 데이터를 재사용한다. 웹 방문마다 UW를 재수집하거나 전체 GEX 이력을 브라우저에 저장하지 않는다.
- 종목별 이력 파일을 상세에서 필요할 때 읽는다. 홈페이지의 매 요청 응답에 장기 이력을 모두 붙이지 않는다.
- 최초 복구는 현재 남은 캐시·원본을 출처와 함께 보존하는 수준이다. 그보다 오래된 당시 IV의 복원 가능성은 **미검증**이며 가짜 과거 이력을 만들지 않는다.
- `fromAnchor=false`이고 최초 관측 시각도 없는 과거 값은 당시 알려진 신호로 단정할 수 없다. 기술적 회고 차트와 실제 이용 가능 시점에 따른 전략 검증을 구별한다.

성공 기준은 “매주 화면이 바뀜”이 아니라 기존 완료 주 값 보존, 새 주 추가, 정정 revision 추적, 휴장 주 처리, 새 주로 넘어가도 과거 표시가 바뀌지 않는 것이다. 운영 스케줄·테스트 채널·본방 정책은 변경하지 않는다.

## 6. My Sigma 포트폴리오

기본 구성은 `관심목록 / 포트폴리오`, 포트폴리오 안에 `비중 시뮬레이션 / 보유 관리`다. 사용자에게 두 용도와 차트 우선순위를 질문했으며, 답변 전 설계 기본값은 두 용도를 모두 제공하고 주가·당시 σ 이력을 먼저 구현하는 것이다.

### 비중 시뮬레이션

- 저장된 종목을 선택해 비중을 입력한다. 추가/제외가 기존 관심목록을 지우지 않는다.
- 기간 시작 비중, 시작일, 투자금(선택), 현금 비중을 명시한다. 합계 100%를 검사하고 입력값을 몰래 정규화하지 않는다. 100% 초과·음수·비유한값은 저장을 막는다.
- 최초 버전은 **기간 시작 비중으로 매수 후 보유, 자동 리밸런싱 없음**으로 정의한다. 기간 중 비중은 가격에 따라 변한다.
- 누적 모형 가격수익률: `Σ w_i,start × (P_i,t / P_i,start − 1)`. 현금은 이자 0 가정이다.
- 모형 일간 수익률: `V_t / V_previous − 1`. 매일 최초 비중을 재적용하면 일간 리밸런싱 전략이 되므로 그렇게 계산하지 않는다.
- 검산 예: A 60%·B 40%, 각 +10%·−5%이면 +4%. A/B 50:50으로 첫날 +100%/0%, 다음날 −50%/0%이면 2일 누적 0%, 둘째 날 −33.3333%다.
- 같은 조정 정책·공통 가격일이 있는 구간만 계산한다. 가격 누락 종목을 빼고 나머지 비중을 자동 재분배하지 않는다.
- 1D/1W/1M/3M/YTD/1Y 버튼은 데이터 범위에 따라 활성화한다. 현재 20거래일만으로 1개월을 항상 계산할 수 있는 것도 아니다.
- SPY/QQQ 비교와 종목별 수익 기여도는 같은 기간·같은 수익률 종류를 사용한다.
- 현재 데이터는 배당·환율·세금·수수료 포함 총수익이 아니다. 화면 이름은 “모형 가격수익률”로 한다.

### 보유 관리

- 기본 입력: 종목, 보유 시작/기준일, 수량, 평균 매입단가, 통화. 현재 미국 종목 데이터에 맞춰 USD 기준으로 시작한다.
- “평가금액으로 입력”도 제공할 수 있다. **기준일 종가와 평가금액으로 수량을 한 번 산출해 저장**한다. 매일 금액을 고정해 수량을 재계산하지 않는다.
- `평가금액 = 수량 × 현재가`, `원가 = 수량 × 평단`, `미실현손익 = 평가금액 − 원가`, `미실현수익률 = 손익 / 원가`.
- 실제 비중은 평가금액에서 계산한다. 사용자가 원하는 목표 비중과 나란히 표시하고 차이(%p)를 보여준다. 실제 수량과 비중을 동시에 독립 편집해 모순되는 값을 저장하지 않는다.
- 전일과 수량이 동일하다는 기록이 있는 경우 `일간손익 = Σ q_i × (P_i,t − P_i,previous)`다. 전일 평가액을 분모로 쓰며 현재 비중으로 가중하지 않는다.
- 평단·현재 평가금액만으로 과거 실제 계좌 수익률을 복구할 수는 없다. 첫 입력은 “기초 보유 등록”으로 기록하고, 추적 시작 이전에는 미실현 손익만 제공한다.
- 매수·매도·추가 입금·출금·배당·수수료·분할 조정은 날짜 있는 원장 이벤트로 저장한다. 보유량 수정이 과거 전체 이력을 다시 쓰지 않게 한다.
- 실제 추적 기간의 계좌 성과는 일별 평가와 현금흐름으로 TWR를 산출한다. 내부 매매와 외부 입출금을 구분하고 현금도 계좌 가치에 포함한다. 당일 처리 순서를 명시한다. 원장이나 조정 데이터가 없으면 실제 기간수익률을 숨긴다.
- 원화 성과는 날짜별 FX 원본이 확보된 후 지원한다. 현재 환율 하나로 과거 전체를 환산하지 않는다.

### 화면과 저장

```text
My Sigma                  [관심목록] [포트폴리오]

미국 주식                  [비중 시뮬레이션] [보유 관리]
평가액        일간 손익        미실현 손익
기간 선택 · 수익 곡선 · SPY/QQQ 비교

종목   실제 비중 / 목표 비중   가격   평단   평가액   일간 기여도
NVDA   …                    …      …      …        …

[관심목록에서 추가] [거래 기록] [백업 내보내기]
```

- 모바일은 전체 수익 곡선 → 상위 기여 종목 → 편집 가능한 종목 행 순서다. 긴 표의 필수값은 행 안에 재배치한다.
- 별도 versioned 저장키(예: `sigma-personal-portfolios:v1`)를 사용한다. 관심목록 공유·삭제와 보유정보 삭제를 분리한다.
- 브라우저 저장만으로 시작하면 기기 동기화·복구가 없음을 명시하고 JSON 내보내기/가져오기, 손상 복구·백업을 함께 제공한다.
- 수정 시 버전 충돌을 감지하고 다른 탭의 새 기록을 덮어쓰지 않는다. 마이그레이션 전 원본 백업을 보존한다.
- 공유 URL·이미지·Vercel 이벤트에 수량, 평단, 평가액, 전체 구성, 원장을 넣지 않는다. 관심목록 제거가 포트폴리오 기록을 삭제하지 않는다.

참고한 공식 서비스에서 가져올 요소:

- [TradingView Holdings](https://www.tradingview.com/support/solutions/43000756132-holdings-page/): 보유 비중·수량·평단·평가액·일간 손익을 함께 읽는 종목 행 구성.
- [Sharesight Portfolio Investments](https://help.sharesight.com/au/show_portfolio/): 기간 선택과 포트폴리오 요약을 연결하는 구조.
- [Sharesight Contribution Analysis](https://help.sharesight.com/contribution-analysis-report/): 전체 성과를 움직인 종목을 기여도로 확인하는 방식.
- [Portfolio Performance TWR](https://help.portfolio-performance.info/en/concepts/performance/time-weighted/): 입출금과 운용 성과를 분리하는 계산 기준.

이들의 기능 구조를 참고하며 화면을 그대로 복제하지 않는다. 1SIGMA에서는 비중과 함께 당시 σ를 읽을 수 있는 점에 집중한다.

## 7. 변경 묶음, 파일과 회귀 위험

원래 5개 PR에 이력·포트폴리오 요구가 추가됐으므로 계산/저장/차트/이미지/SEO를 섞지 않도록 아래처럼 분리한다. 아래는 계획이며 실제 PR은 생성하지 않았다.

| 순서 | 주요 수정·추가 후보 | 검증할 회귀 위험 |
|---|---|---|
| 3-0 기준선 보완 | `tests/mobile-flow.test.mjs`, `tests/calendar-display.test.mjs`, `watch-button.tsx`, `app/my-sigma/page.tsx` | 20개 정책 유지, 날짜·언어 귀속 검증을 DOM ID 문자열 검사와 구분 |
| 3-1 σ 계약·요약 | `lib/sigma.ts`, 신규 `lib/watchlist-summary.ts`, `lib/types.ts`, `lib/snapshot/*`, `components/my-sigma/*` | 누락→0 오류, ±1 포함 경계, 동일 출처·주차·시점 비교, 전체 분모 보존 |
| 3-2 장기 이력·주가/σ 차트 | 상류 `tools/dashboard_snapshot.py`, `tools/publish_static_snapshot.py`, 신규 이력 저장 모듈; 웹 신규 `lib/sigma-history.ts`, `components/dashboard/sigma-history-chart.tsx`, 상세 page | 과거 IV 오염, 금요일 리셋, 휴장, 조정주가, 정정 발행, 파일/트래픽 증가. 기존 σ 산식과 운영 캐시는 유지 |
| 3-3 포트폴리오 | 신규 `lib/portfolio/{types,storage,returns,ledger}.ts`, `hooks/use-portfolio.ts`, `components/portfolio/*`, My Sigma 탭 | 실제/가상 수익률 혼동, 기준일·분모·비중 드리프트, 입출금·매매, 개인정보, 손상/동시 쓰기 |
| 3-4 최근 변화 | 신규 `lib/watchlist-observations.ts`, 전용 hook, `components/my-sigma/watchlist-changes.tsx` | 같은 ID 중복, 정정/주차 변경, 추가한 종목을 데이터 복구로 오인, 브라우저 저장 증가 |
| 3-5 공유 PNG | 신규 공유 데이터 모델/렌더 함수, `components/share/symbol-share.tsx`, 이미지 경로 | 한글 폰트, 긴 이름, 누락값, 준비/공유 분리, AbortError, 사용자 데이터 유출 |
| 3-6 OG·SEO | `app/symbol/[symbol]/opengraph-image.tsx` 또는 이미지 route, 상세 metadata/관련종목, 404 경계 | 페이지/이미지 서로 다른 snapshot, 실제 HTTP 404, SSR 언어, canonical, 기존 캐시 정책 |
| 3-7 홈 개인화 | `components/watchlist/home-watchlist.tsx`, `dashboard.tsx` | 검증된 요약 재사용, hydration, 로컬 준비 전 빈 목록 깜빡임, 중복 계산 |

최근 변화는 최대 4개 관측만 저장한다. 전체 차트/GEX는 저장하지 않는다. 같은 snapshot은 비교하지 않으며 새 밴드에서는 경계 복귀를 생성하지 않는다. 같은 주·호환 가능한 데이터끼리 상단/하단 진입, 복귀, 기존 0.85 경계 근접, 최대 이동을 계산한다. 첫 관측·새 저장 종목·가격 미제공을 구별한다. 데이터 정정은 같은 날짜의 새로운 시장 움직임처럼 표현하지 않는다.

## 8. 이미지 렌더링 후보와 SEO 실측

현재 주간 캔들은 직접 작성한 **SVG**다. Canvas 캡처가 아니다. 기존 루트 OG와 일일 리포트 OG는 Next `ImageResponse`를 사용한다.

| 방법 | 판단 |
|---|---|
| 서버 `ImageResponse`로 요약 PNG 1080×1350, OG 1200×630 | 우선 후보. 기존 기술과 맞고 동일 공개 데이터 모델을 재사용할 수 있다. 한글 폰트·크기·줄바꿈·오류 fallback을 검증한다 |
| 브라우저 전용 Canvas 요약 카드 | 대안. 페이지가 받은 값으로 정확히 고정 가능하나 폰트 준비·텍스트 배치·모바일 메모리 관리 필요 |
| 차트 SVG를 공유 크기로 별도 렌더한 뒤 PNG 변환 | 후속. 실제 화면 전체 캡처 대신 가격축·여백·폰트를 공유 규격으로 그린다 |

요약 카드부터 구현하며 차트 포함 카드는 안정화 이후 추가한다. 이미지 준비와 OS 공유는 별도 클릭이다. 파일 공유 미지원은 다운로드, 사용자 취소는 정상 취소다. URL object는 교체·닫기 때 해제한다.

**이미지 일치 조건:** 공통 함수만 쓰는 것으로는 부족하다. snapshot ID를 이미지 URL에 포함하고 그 ID의 공개 데이터 revision을 읽어야 한다. 없거나 만료된 ID를 최신 값으로 몰래 대체하지 않는다. 이는 공개 종목 이미지 데이터의 일치 장치이며 `?date=` 링크가 과거 페이지를 보존한다고 약속하는 기능과는 별개다.

이번 직접 HTTP 점검:

- NVDA: **200**, 서버 HTML에 $227.38, +0.58σ, $213.47–$231.07, 기준가·가격일 존재.
- canonical: `https://sigma-dashboard-five.vercel.app/symbol/NVDA` 일치.
- 한국어 요청: `<html lang="ko">`와 한국어 metadata 일치. 다만 제목의 Expected Move, 설명의 `Sep 21 close`는 혼용 상태다.
- NVDA HTML에서 `og:image`, `twitter:image` 태그가 확인되지 않았다. 종목별 OG 파일도 없다.
- 루트 `/opengraph-image`: **200**, PNG. 이 결과를 종목 OG 성공으로 세지 않는다.
- 존재하지 않는 `/symbol/NOT_A_REAL_SYMBOL_123`: **HTTP 200**, 오류 UI·noindex 있음. Next 16.3.1 로컬 가이드의 스트리밍 notFound 동작과 부합하며 “실제 404” 요구는 아직 미충족이다.
- sitemap: **200**, 131 URL 중 종목 123개가 현재 스냅샷과 정확히 일치. 모두 기존 canonical origin. 131개를 전부 개별 GET한 것은 아니다.
- 외부 웹 리더의 NVDA 내용은 9/18로 오래돼 있었으나 직접 HTTP 응답과 API는 9/21로 일치했다. 웹 리더 결과만으로 운영 stale을 단정하지 않았다.

관련 종목은 현재 유효 목록에서 같은 섹터 → 같은 테마 → 정해진 목록 순서/티커 순으로 결정적으로 선정하고 자신을 제외한다. 기존 테마성 섹터 이름을 사용자 승인 없이 다시 산업 분류명으로 바꾸지 않는다.

## 9. 실행한 검증과 이후 테스트

| 명령/확인 | 결과 |
|---|---|
| `git status`, branch/log, fetch, origin diff | 실제 원본 기준 동기화 확인 |
| `npm run lint` | 통과 |
| `./node_modules/.bin/tsc --noEmit --incremental false` | 통과 |
| `node --test tests/*.test.mjs` | **67개 중 64 통과 / 3 실패** |
| `SNAPSHOT_SOURCE=file npm run build` | 원본 저장소에서 기본 Turbopack 빌드 통과 |
| 운영 API vs 공개 원본 vs 로컬 원본 | 가격 배열·데이터 일치 |
| 기존 함수의 ±1 경계·σ 누락 | 직접 메모리 사본으로 재현 |

실패 3개는 기존 코드 기준이다:

1. `tests/mobile-flow.test.mjs:24`: 실제 한도 20에 대해 10에서 추가를 막으라는 옛 기대값.
2. `tests/calendar-display.test.mjs:40`: 삭제된 모바일 캘린더 DOM ID 패턴 기대.
3. `tests/calendar-display.test.mjs:51`: 같은 DOM ID 기대와 영어 날짜 배치 검사.

현재 package scripts에는 test/typecheck가 없다. 해당 작업은 위 직접 명령으로 실행했다. lint/typecheck/test는 같은 SHA의 `sector-expansion`, 빌드는 symlink 외부 경로 문제를 피하려고 원본에서 실행했다. 파일 스냅샷 빌드 성공은 운영 API와 모바일 공유 성공을 뜻하지 않는다.

새 기능 필수 테스트:

- 요약: 0/1/20개, 전부/일부/전체 누락, +2/−2, 정확한 ±1과 원시 0.9999/1.0001, 다른 snapshot/밴드/방식/시각, off-board 종목.
- 이력: 금요일 이전 주 결산과 새 주 0σ 구별, 휴장 주, 당시 밴드 누락, 첫 관측 이전 값, 정정 revision, 가격 조정, 아직 도래하지 않은 1/2/4주 결과.
- 변화: 같은 ID, 같은 세션 정정, 새 세션, 새 주, 경계 양방향 통과, 신규 관심종목, 데이터 소실·복구, localStorage 손상/실패/상한.
- 모형: 60:40 예제 +4%, 비중 드리프트 예제, 현금, 소수 비중, 합계/음수/NaN, 공통 날짜 누락, 상장일, 벤치마크 동일 기준, 투자금 변경 시 % 불변.
- 보유: 평단·수량·평가액 입력 일치, 평가액 입력 시 기준가 고정, 전일 비중 분모, 기간 중 매매·입출금, 현금 이동, 분할, 기록 이전 기간 숨김, 잘못된 통화/가격, 원장 수정·백업·동시 탭 충돌.
- 이미지: 생성 성공/실패, 한글·긴 이름·가격 자릿수, σ/GEX 누락, 고정 테마, 지원/미지원 파일 공유, PNG 다운로드, AbortError, snapshot 불일치·만료.
- SEO: 유효 200/무효 실제404, locale/canonical, 이미지200·치수·동일 snapshot, SSR 주요 값, 관련 href, sitemap 유효 종목.
- 화면: 360/390/430px, 데스크톱, 키보드·터치 선택, 세로 스크롤, 빈 상태·저장실패·과도한 긴 입력. 실제 iOS Safari/Android Chrome/카카오 공유창·저장은 별도 수동 점검.
- 이벤트: 지정된 카운트·surface만 수집하고 전체 티커 목록·보유정보·개인 URL을 제외한다. 운영 전 payload를 테스트한다.

이번에는 **새 기능 테스트, 모바일 화면 재측정, 실제 휴대폰·OS 공유창, 새 이미지 생성, 수익률 원장 검증을 실행하지 않았다.** 구현 전 기준선 점검과 계산·화면 설계까지 완료한 상태다.
