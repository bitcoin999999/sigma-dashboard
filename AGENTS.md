<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# sigma-dashboard

사용자가 **"홈페이지"**라고 부르면 이 프로젝트를 뜻한다. 사이트 제목은
**SigmaRange · Market Range Monitor**(2026-09-26 사용자 확정, 이전 1SIGMA). `../oi_shock`이 산출하는 주간 1σ 밴드를 웹으로 보여주는
대시보드다(금요일 종가 앵커 기준 밴드 소진율).

대표 주소는 **https://sigmarange.com**. 이름·canonical·공유 주소의 단일 출처는 `lib/site.ts`다.
브랜드 로고는 2026-09-27 사용자가 승인한 **민트색 기하학적 SR 결합 A안**이다.
벡터·색상의 단일 원본은 `lib/brand.ts`, 생성 명령은 `npm run brand:generate`.
헤더·푸터·공유 이미지·탭·모바일 홈 아이콘에 공통 적용한다. 과거 σ 마크나 다른 시안으로 되돌리지 말 것.
아이콘 메타데이터·캐시 주의사항은 `docs/agent-context/brand.md` 참고.
가비아 `A @ 76.76.21.21`, TTL 600으로 연결했고 2026-09-26 DNS·HTTPS를 확인했다.
`www.sigmarange.com`은 **코드가 아니라 Vercel 프로젝트 도메인 설정**에서 apex로 308 리디렉션한다
(2026-09-27, 경로·쿼리 보존). 확인: `vercel api /v9/projects/sigma-dashboard/domains --scope svpk1`.
www의 DNS는 가비아 `A www 76.76.21.21`(Vercel CLI 권장값, 2026-09-27 사용자 추가)이고 www 인증서는
Vercel이 자동 발급했다. ⚠️ 가비아 SOA의 negative TTL이 **86400초(24시간)**라, 새 레코드를 추가하기 전에
그 이름을 조회한 리졸버는 최대 하루 동안 "없음"을 기억할 수 있다. 추가 직후 확인은 권한 서버·8.8.8.8에 직접 물을 것.
옛 `sigma-dashboard-five.vercel.app`은 My Sigma 이전 때문에 일부러 리디렉션하지 않는다.

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

## Google AdSense (2026-09-26 준비, 계정·승인 전)

- 게시자 ID의 단일 출처는 `lib/site.ts`의 `ADSENSE_CLIENT`, 판정 규칙은 `lib/adsense.ts`.
  비어 있으면 광고 스크립트·`google-adsense-account` 메타 태그가 없고 `/ads.txt`는 404다.
  **형식(`ca-pub-`+16자리)이 틀리면 `next build`가 실패하고 테스트도 실패한다** — 오타 하나로
  광고가 조용히 꺼지는 일을 막으려는 것이니 이 검사를 느슨하게 만들지 말 것.
- 광고 코드는 **`sigmarange.com` 호스트에서만** 로드한다(옛 vercel.app·www·localhost 제외).
- `/my-sigma/transfer`는 포트폴리오를 창 사이 postMessage로 넘기는 페이지라 **광고 코드 금지**.
  이미 실행 중인 스크립트는 내릴 수 없으므로 이 페이지로 가는 링크는 `<Link>`가 아니라 `<a>`여야
  한다(`tests/adsense.test.mjs`가 감시).
- `/about`·`/privacy`는 심사용 페이지다. 개인정보처리방침 내용을 바꾸면 `EFFECTIVE` 날짜를 갱신할 것.
  `CONTACT_EMAIL`이 비어 있으면 두 페이지에서 문의 섹션이 빠진다.
- 9/23 브랜치 `claude/sigmarange-domain`은 이 작업으로 대체됐다. **병합 금지** — 그 브랜치의
  옛 호스트 308 리다이렉트는 옛 주소 localStorage에 닿는 My Sigma 이전 흐름을 막는다.
- 배포 후 확인: `curl -s https://sigmarange.com/ | grep -c adsbygoogle.js`(1이어야 함),
  `curl -s https://sigmarange.com/ads.txt`.

## 데이터 흐름

이 저장소는 **1σ를 계산하지 않는다.** 산식의 단일 출처는 `../oi_shock/sigma_core.py`다.

```
oi_shock/tools/dashboard_snapshot.py   (UW API + sigma_core → 로컬 JSON)
  → tools/publish_static_snapshot.py   (sigma-snapshot-data에 JSON만 정적 배포)
  → 이 대시보드가 읽음
```

발행은 `oi_shock/tools/publish_snapshot.sh`가 담당하고
`com.oi-shock.dashboard-snapshot` launchd 잡이 **화~금 EDT 05:35 / EST 06:35 KST,
토 07:00 KST**에 돌린다. 평일 07:00에는 종가를 재검증하고 바뀐 경우에만 정정 발행한다.
숫자가 이상하면 이 저장소가 아니라 스냅샷 생성 쪽부터 볼 것.

**2026-09-15부터 Blob을 사용하지 않는다.** 사용량 한도 초과로 공개 읽기가 403이 되어
사용자가 추가 결제 없는 정적 파일 배포를 선택했다. 운영은 `SNAPSHOT_SOURCE=http`,
`SNAPSHOT_URL=https://sigma-snapshot-data.vercel.app/snapshot/latest.json`을 사용한다.
데이터 배포는 이 저장소를 업로드하지 않으며, 임시 디렉터리에 JSON/robots/config만 담는다.
발행 성공 조건은 커버리지 검사 + 배포 READY + 공개 파일과 홈페이지 API의 원본 일치다.
옛 Blob 환경변수/드라이버는 이력·명시적 롤백용이며 임의로 다시 활성화하지 말 것.

`/api/calendar`는 같은 배포의 `snapshot/calendar-context.json`(기준일·96종목명, 현재736B)을
읽는다. 일정 폴링마다 시장 전체 파일(987,612B)을 다시 읽던 구조로 되돌리지 말 것.
UI 60초 확인·서버 정상10분/부분실패30초 TTL·ko/en 시간대·주 전환 규칙은 유지한다.

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

## 종목 추가·빼기·섹터 변경 (2026-09-27~)

- 사용자는 맥의 **'SigmaRange 종목관리' 앱**으로 직접 한다. 도구는 `../oi_shock/tools/symbol_admin.py`이고
  **이 저장소의 코드 변경·배포 없이** 데이터 배포만으로 반영된다(홈페이지는 스냅샷이 종목 목록을 정한다).
- 부탁을 받으면 이 저장소가 아니라 그 도구의 CLI를 쓸 것. 규칙·주의점은 `../oi_shock/AGENTS.md`의 같은 절과
  `../oi_shock/docs/agent-context/symbol-admin.md`.
- 사용자가 새 섹터를 만들면 섹터 제목은 영어 키 그대로 뜨고, 필터·상세의 한글 라벨만 비어 있다.
  한글로 보이게 하려면 `lib/classification.ts`의 `CLASSIFICATION_LABELS`에 추가 후 배포.
