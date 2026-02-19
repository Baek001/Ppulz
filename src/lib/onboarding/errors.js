export function toOnboardingErrorMessage(error) {
  const rawMessage = error?.message ?? '서버 처리 중 오류가 발생했습니다.';

  if (rawMessage.includes("Could not find the table 'public.user_onboarding'")) {
    return 'Supabase에 user_onboarding 테이블이 없습니다. SQL 마이그레이션을 먼저 실행해야 합니다.';
  }

  if (rawMessage.includes("Could not find the table 'public.example_cards'")) {
    return 'Supabase에 example_cards 테이블이 없습니다. SQL 마이그레이션 후 예시카드 import를 실행해야 합니다.';
  }

  return rawMessage;
}
