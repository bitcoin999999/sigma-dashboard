# 모바일 1단계 작업 메모

2026-09-18 기준 `codex/mobile-stage1`에서 모바일 홈·탐색 동선과 링크 공유를 보완했다.

- 실제 데이터 산식은 건드리지 않았다. `sigma_core.py`와 스냅샷 계약은 그대로다.
- 저장소 키는 `sigma-personal-watchlist`, 최대 10개를 유지한다.
- 관심 목록 외부 저장소는 `hooks/use-watchlist.ts` 한 곳에서 읽기·쓰기·교차 탭 이벤트를 관리한다.
- 홈의 문서 순서는 모바일에서 `HomeWatchlist` → `watchlist` 목록 → 기존 시장 요약/캘린더/리포트다. 데스크톱은 기존 시장 우선 순서를 CSS order로 유지한다.
- 종목 상세 링크는 카드·표에 실제 `href`를 제공한다. 데스크톱의 평범한 클릭만 패널을 열고, 모바일·수정 클릭은 페이지 이동한다.
- `hooks/use-board-state.ts`와 `lib/board-navigation.ts`가 필터/정렬과 스크롤 복원을 담당한다. Next history state는 spread로 보존한다.
- 공유는 현재 종목의 최신 URL만 제공한다. 과거 시점 보존은 불변 스냅샷 저장 기능이 구현되기 전에는 추가하지 않는다.

로컬 seed 미리보기의 측정값과 미검증 환경은 `docs/reviews/2026-09-18/mobile-stage1.md`에 기록했다. 프로덕션 배포 전에는 `git status`, `vercel link --yes --scope svpk1 --project sigma-dashboard`, 실제 스냅샷 환경을 별도로 확인해야 한다.
