> 출처: Claude Code auto-memory `project_sigma_dashboard.md` — 마지막 갱신 **2026-08-23**, 2026-08-25 이관.
> 특정 시점의 관찰 기록이다. 코드와 어긋날 수 있으니 사실로 단정하기 전에 현재 코드를 확인할 것.

사용자가 "홈페이지"라고 지칭하면 `~/projects/sigma-dashboard`를 뜻한다. 사이트 제목은 **1SIGMA · Market Range Monitor**로, [[project_oi_shock]]의 주간 1σ 밴드를 웹으로 보여주는 대시보드다(75종목, 금요일 종가 앵커 기준 밴드 소진율).

Vercel 팀 `centme-9969`, 프로젝트명 `sigma-dashboard`에 배포돼 있다.

**방문자 데이터는 2026-08-23 이전이 존재하지 않는다.** 그날까지 애널리틱스가 아예 붙어 있지 않았고(`@vercel/analytics`·GA·Plausible 전부 없음), 그날 `@vercel/analytics` v2를 루트 레이아웃에 추가했다.

**Why:** 사용자가 일 방문자수를 물었을 때 수집 자체가 없어서 답할 수 없었고, 소급 복원도 불가능했다.

**How to apply:** 트래픽·방문자 질문이 오면 2026-08-23 이후 구간만 유효하다고 전제할 것. 그 이전을 물으면 데이터 없음을 먼저 알릴 것. 단, Vercel 대시보드 **Observability**의 엣지 요청 수는 패키지와 무관하게 그 이전에도 남아 있으나 봇·정적자산 포함이라 방문자수와 다른 지표다.

**주의:** Vercel Web Analytics는 코드 추가만으로는 켜지지 않고 프로젝트 설정에서 별도 활성화가 필요하다. 수치가 0이면 이 토글부터 확인할 것.
