<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# sigma-dashboard

사용자가 **"홈페이지"**라고 부르면 이 프로젝트를 뜻한다. 사이트 제목은
**1SIGMA · Market Range Monitor**. `../oi_shock`이 산출하는 주간 1σ 밴드를 웹으로 보여주는
대시보드다(금요일 종가 앵커 기준 밴드 소진율).

Vercel 팀 **`SVPK`(슬러그 `svpk1`)** / 프로젝트 `sigma-dashboard`에 배포돼 있다.
`centme-9969`는 팀이 아니라 **로그인 사용자명**이다(`vercel whoami`가 이걸 뱉는다).

⚠️ **이 저장소는 git 연동 배포가 아니다.** 작업 디렉터리에서 `vercel --prod`로 직접 올린다.
그래서 **프로덕션이 git보다 앞서 있을 수 있다**(실제로 2026-08-25에 이미 라이브인 코드가
미커밋으로 남아 있는 걸 발견했다). 배포 전에 `git status`를 먼저 볼 것.

`.vercel/`는 gitignore 대상이라 클론·새 체크아웃에는 없다. 없으면 `vercel --prod`가
프로젝트를 못 찾고 개인 스코프에 새로 만들려다 **권한 오류**를 낸다. 먼저 링크할 것:

```bash
vercel link --yes --scope svpk1 --project sigma-dashboard
vercel --prod --scope svpk1
```

**`--scope svpk1`은 배포할 때도 붙여야 한다.** `.vercel/project.json`에 팀 ID가 적혀
있어도 CLI는 로그인 사용자의 개인 스코프를 기본으로 잡아서, 빼면 `Not authorized`로
떨어진다(2026-08-26에 겪었다). 링크 한 번 했으니 됐다고 넘어가지 말 것.

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
(`@vercel/analytics`·GA·Plausible 전부 없음), 그날 `@vercel/analytics` v2를 루트 레이아웃에 **코드로만**
추가했다. 소급 복원은 불가능하다.

**수집 시작 시점은 코드 추가일이 아니라 배포일이다.** 2026-08-25까지 이 코드는 미배포 상태였고
그날 커밋 `af6ee0d`와 함께 배포했다. 즉 **실제 데이터는 2026-08-25부터**다.

살아 있는지 확인하려면 **서버 HTML을 grep 하지 말 것.** `<Analytics />`는 `useEffect`로
클라이언트에서 스크립트를 주입하므로 SSR HTML에는 절대 안 나온다(이걸로 "미배포"라고
오판한 적 있다). 대신:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://sigma-dashboard-five.vercel.app/_vercel/insights/script.js
```

**200이면 정상**(프로젝트 설정의 Web Analytics 토글까지 켜져 있다는 뜻). 꺼져 있으면 404다.

- 트래픽 질문이 오면 2026-08-23 이후 구간만 유효하다고 전제할 것. 그 이전을 물으면 데이터 없음을 먼저 알릴 것.
- Vercel **Observability**의 엣지 요청 수는 그 이전에도 남아 있으나 봇·정적자산이 섞여 있어
  방문자수와는 다른 지표다.
- Vercel Web Analytics는 **코드 추가만으로 켜지지 않는다.** 프로젝트 설정에서 별도 활성화가 필요하다.
  수치가 0이면 이 토글부터 확인할 것.
