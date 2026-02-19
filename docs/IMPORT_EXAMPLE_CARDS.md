# IMPORT_EXAMPLE_CARDS

## 목적
`example_cards` 테이블에 `PPulse_example_cards_200_v2.json` 200장을 업서트합니다.

- 업서트 키: `card_id`
- 기존 row 있으면 갱신, 없으면 삽입
- 완료 후 `example_cards` row count가 반드시 `200`이어야 성공

## 사전 준비
1. Supabase 마이그레이션 실행
- `supabase/migrations/20260219_onboarding.sql`

2. 예시카드 JSON을 작업 루트로 복사

PowerShell:
```powershell
New-Item -ItemType Directory -Force data
Copy-Item /mnt/data/PPulse_example_cards_200_v2.json data/example_cards.json
```

참고: `/mnt/data/...` 접근이 불가한 환경이면 동일 파일을 `data/example_cards.json`으로 직접 복사해도 됩니다.

3. 환경변수 설정
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 실행
기본 경로(`data/example_cards.json`) 사용:
```bash
npm run import:example-cards
```

사용자 지정 파일 경로 사용:
```bash
npm run import:example-cards -- data/example_cards.json
```

## 성공 기준
- 스크립트가 `example_cards import 성공: 200 rows (news 100 / bill 100)` 출력
- `example_cards` 총 row 수가 정확히 `200`

## 실패 조건
아래 중 하나라도 발생하면 스크립트는 실패(exit code 1)합니다.

- JSON 카드 수가 200이 아님
- `card_id` 중복 또는 누락
- `card_type`이 `news/bill` 외 값
- import 후 `example_cards` row count가 200이 아님
