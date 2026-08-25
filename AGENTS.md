<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# sigma-dashboard

사용자가 **"홈페이지"**라고 부르면 이 프로젝트를 뜻한다. 사이트 제목은
**1SIGMA · Market Range Monitor**. `../oi_shock`이 산출하는 주간 1σ 밴드를 웹으로 보여주는
대시보드다(금요일 종가 앵커 기준 밴드 소진율).

Vercel 팀 `centme-9969` / 프로젝트 `sigma-dashboard`에 배포돼 있다.

## 데이터 흐름

이 저장소는 **1σ를 계산하지 않는다.** 산식의 단일 출처는 `../oi_shock/sigma_core.py`다.

```
oi_shock/tools/dashboard_snapshot.py   (UW API + sigma_core → 로컬 JSON)
  → vercel blob put                    (고정 pathname 덮어쓰기)
  → 이 대시보드가 읽음
```

발행은 `oi_shock/tools/publish_snapshot.sh`가 담당하고
`com.oi-shock.dashboard-snapshot` launchd 잡이 **화~토 07:00 KST**에 돌린다.
숫자가 이상하면 이 저장소가 아니라 스냅샷 생성 쪽부터 볼 것.

## 방문자·트래픽 데이터

**2026-08-23 이전 데이터는 존재하지 않는다.** 그날까지 애널리틱스가 아예 붙어 있지 않았고
(`@vercel/analytics`·GA·Plausible 전부 없음), 그날 `@vercel/analytics` v2를 루트 레이아웃에 추가했다.
소급 복원은 불가능하다.

- 트래픽 질문이 오면 2026-08-23 이후 구간만 유효하다고 전제할 것. 그 이전을 물으면 데이터 없음을 먼저 알릴 것.
- Vercel **Observability**의 엣지 요청 수는 그 이전에도 남아 있으나 봇·정적자산이 섞여 있어
  방문자수와는 다른 지표다.
- Vercel Web Analytics는 **코드 추가만으로 켜지지 않는다.** 프로젝트 설정에서 별도 활성화가 필요하다.
  수치가 0이면 이 토글부터 확인할 것.
