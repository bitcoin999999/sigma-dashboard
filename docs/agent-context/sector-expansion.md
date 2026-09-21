# 2026-09-22 사용자 확정: 기존 테마 그룹 복원

**아래 9/21의 표준 산업 섹터 재분류 방침을 대체한다.** 사용자는 반도체·광통신·소프트웨어 등이 분리된 이전 그룹을 선호한다고 명시했다. `sector`는 다시 사용자가 정한 화면 그룹이다. 표준 산업 분류를 이유로 합치거나 기존 사용자 지정 배치를 이동하지 말 것.

- 기존 97개를 확장 전 스냅샷의 14개 그룹으로 정확히 복원한다. DELL은 Semiconductors, ETN/VRT/SEDG/CLS는 Power, IREN/WULF/KEEL은 Neocloud 등 기존 지정도 보존한다.
- 신규 15개만 배치: Financials=JPM/GS/V, Energy=XOM/CVX/SLB, Industrials & Defense=CAT/RTX/LMT, Power=CEG/VST, Real Estate=PLD/EQIX, Benchmarks & ETF=CIBR, Networking=ANET.
- 기존 CRWD/PANW를 신규 사이버보안 그룹으로 옮기지 않는다. Software 유지. CIBR은 IGV/SOXX처럼 기존 ETF 그룹에 추가한다.
- ANET은 데이터센터/클라우드 네트워크 장비가 중심이므로 Networking을 만든다. [Arista 사업 소개](https://www.arista.com/en/company/company-overview), [CIBR 운용사](https://www.ftportfolios.com/retail/etf/EtfSummary.aspx?Ticker=CIBR).
- 신규 15개 유지, 일반 모니터 112 + SPDR ETF 11 = 123개. SPDR ETF의 별도 목록은 유지한다.
- 카탈로그의 sector만 복원한다. assetClass/themes/region, σ 산식, 가격/차트/GEX, 알람 모집단·스케줄은 그대로다. 발행 시 현재 스냅샷을 백업하고 sector 외 모든 필드와 종목 순서가 같은지 비교한다. 가격을 다시 수집하거나 과거 스냅샷으로 교체하지 않는다.
- 알 수 없는 새 동적 ETF 구성종목은 원본 그룹명을 통해 Semiconductors/Software 등을 이어받는다. 유형·지역은 임의 추정 없이 unknown/Unknown 유지.
- 확장 전 97개 그룹을 테스트 fixture로 보존하여 재분류 회귀를 검사한다.

---

# 2026-09-21 종목 확장·분류 구조

## 범위와 숫자

사용자 요청은 추천 25개 편입 및 분류 구조 변경이다. 상세 UI 재구성·관심목록·공유·최근 본 종목 변경은 제외했다.

- 요청: XLF, JPM, GS, V, XLE, XOM, CVX, SLB, XLI, CAT, RTX, LMT, XLU, CEG, VST, ETN, XLRE, PLD, EQIX, CIBR, CRWD, PANW, ANET, VRT, DELL.
- 기존 10개: XLF, XLE, XLI, XLU, XLRE, ETN, CRWD, PANW, VRT, DELL.
- 신규 15개: JPM, GS, V, XOM, CVX, SLB, CAT, RTX, LMT, CEG, VST, PLD, EQIX, CIBR, ANET.
- 검증 스냅샷: 일반 모니터 97→112개, 별도 SPDR 섹터 ETF 11개 유지, 중복 제외 108→123개. 기존 종목 삭제 없음. ETF 구성종목 변화로 향후 총수는 변할 수 있다.

## 단일 출처와 분류 정의

`oi_shock/data/dashboard-symbols.json`이 홈페이지의 추가 목록·회사명·분류 매핑을 소유한다. `tools/dashboard_universe.py`가 기존 알람의 동적 기본 목록과 홈페이지 추가 목록을 합쳐 중복을 제거한다. 홈페이지는 스냅샷의 필드를 소비하며 티커별 매핑을 복제하지 않는다. 분류 카탈로그 125개 중 APP/CDNS는 동적 ETF 폴백 구성종목용이다. 이 둘을 별도로 강제 추가하지 않는다.

- `assetClass`: equity / etf. 암호화폐 관련 주식도 equity이고 IBIT는 etf다. Crypto는 themes로 분리한다.
- `sector`: 사업 분야 또는 펀드 투자 분야. 11개 산업 섹터 + Broad Market. 공인 GICS 데이터의 복제라고 주장하지 않는다.
- `themes`: 다중 선택 가능한 사업·투자 테마. 기존 Semiconductor/Software/Neocloud/Crypto 등의 탐색 경로를 보존한다.
- `region`: 기업 소속 지역 또는 펀드 투자 대상 지역의 간략한 분류. 상장 거래소 기준이 아니다. US/China/Korea 외는 Global(화면: 글로벌·기타 지역). 매출 지역 비중을 뜻하지 않는다.
- 새로운 동적 구성종목이 카탈로그에 없으면 unknown/Unclassified/Unknown으로 명시하고 경고한다. 임의로 지역·업종을 추정하거나 종목을 누락하지 않는다.

2026-09-21 UW stock info 125개를 확인하고 공급자 업종명을 정규화했다(Financial Services→Financials 등). NBIS·GEV의 낡은 공급자 분류와 COIN·HOOD의 기술 분류는 현재 사업 성격에 맞춰 수동 검토했다. ETF는 투자 대상 섹터로 지정했다. 정적 카탈로그이므로 사업 변경·티커 변경 때 재검토가 필요하다.

참고: [CIBR 운용사](https://www.ftportfolios.com/retail/etf/EtfSummary.aspx?Ticker=CIBR), [SPDR 섹터 분류](https://www.ssga.com/library-content/pdfs/etf/us/sector-investing-a-powerful-portfolio-investing-tool.pdf), [Nebius](https://nebius.com/about), [GE Vernova](https://www.gevernova.com/investors), [Constellation](https://investors.constellationenergy.com/).

## 호환성·운영 경계

`classificationVersion: 1`은 기존 schemaVersion 1에 대한 추가 필드다. 새 프런트는 구 스냅샷도 읽는다. 신규 분류 스냅샷은 유형·지역·테마·중복 티커·양수 가격/앵커/σ를 발행 전에 검사한다. 기존 커버리지 80% 기준은 유지하되 분모에 홈페이지 신규 종목을 포함한다.

홈의 일반 모니터에서 섹터·테마·지역·유형을 AND로 조합한다. 섹터 ETF 11개는 기존 별도 모니터를 유지하며 헤더 검색·상세·사이트맵에 포함된다. 분류 필터의 URL 복원은 이번 범위 밖이다.

sigma_core.py 산식, 차트 엔진, 알람/A-B 모집단, launchd 스케줄, 텔레그램 발송 설정을 변경하지 않는다. 검증 시 실제 캐시를 임시 디렉터리로 복사해 사용했다. 신규 σ는 기존 band_sigma 정책에 따른 값이며 금요일 확정 수집을 소급 주장하지 않는다(from_anchor=false). 과거 밴드는 캐시에 있는 값만 사용한다.

## 검증 결과

- 신규 15/15: 가격·앵커·σ 양수, 세션·앵커 2026-09-18, GEX 제공, 일중 데이터 제공.
- 요청 25/25: Yahoo 30분봉 HTTP 200, 기존 파서에서 2026-09-14~18 정규장 65봉씩. 9/21 22:39 KST CIBR 상세에서는 새 주간 진행 중 봉 1개 표시 확인.
- 기존 108개: 분류 필드 외 숫자·가격·밴드·GEX·히스토리 변경 0건.
- 요청 25/25: 로컬 상세 URL 200·티커 제목 일치·사이트맵 포함. API 배열이 검증 스냅샷과 일치.
- 브라우저: 기술+Cybersecurity+미국+개별주→CRWD/FTNT/PANW 3개, Cybersecurity+ETF→CIBR. CIBR 상세 이동 및 분류·가격·차트 확인.
- 화면 360/390/430/1440px: 문서 가로 넘침 없음, 필터 높이 44px. 390px 상세도 가로 넘침 없음. 실제 iOS/Android/카카오 인앱 기기 테스트는 미실행.
- Python 스냅샷 관련 기존 18개 + 신규 6개 통과.
- 웹 신규 분류 테스트 5개 통과. 전체 66개 중 63개 통과, 기존 실패 3개 그대로(일정 DOM 정규식 2개, 저장 한도를 아직 10개로 기대하는 테스트 1개). 이 작업에서 관심목록/일정 구현을 변경하지 않았다.
- eslint, Next typegen, tsc 통과. 작업 복사본 webpack 빌드 통과. 작업 복사본의 외부 node_modules 심볼릭 링크 때문에 기본 Turbopack은 사용할 수 없어 운영 저장소에서 기본 빌드를 별도 확인한다.

검증 요약은 `docs/reviews/2026-09-21-sector-expansion/validation.json`에 저장한다. 원시 공급자 응답·비밀 키는 커밋하지 않는다.
