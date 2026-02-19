'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import SetupLayout from '@/components/setup/SetupLayout';
import ExampleCard from '@/components/setup/ExampleCard';

const MAX_CHECKED = 6;

// Grid style for examples (2 columns on desktop usually, but let's make it responsive)
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', // Wider cards for news
  gap: '16px',
  width: '100%',
};

export default function ExamplesStep({ cards, initialChecked }) {
  const router = useRouter();
  const validInitialChecked = useMemo(() => {
    const validIdSet = new Set(cards.map((card) => card.card_id));
    return initialChecked.filter((cardId) => validIdSet.has(cardId)).slice(0, MAX_CHECKED);
  }, [cards, initialChecked]);

  const [checkedIds, setCheckedIds] = useState(validInitialChecked);
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState(false);

  function toggleCard(cardId) {
    setErrorMessage('');

    setCheckedIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((item) => item !== cardId);
      }

      if (current.length >= MAX_CHECKED) {
        setErrorMessage('예시카드는 최대 6개까지만 체크할 수 있습니다.');
        return current;
      }

      return [...current, cardId];
    });
  }

  async function completeOnboarding() {
    setPending(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/onboarding/examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checkedCardIds: checkedIds }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? '온보딩 완료 저장에 실패했습니다.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage(error?.message ?? '온보딩 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <SetupLayout
      step={3}
      title={'어떤 스타일의 뉴스를\n원하시나요?'}
      description="관심 가는 예시를 최대 6개까지 체크해주세요."
      currentCount={checkedIds.length}
      totalCount={MAX_CHECKED}
      bottomContent={
        <>
          {errorMessage && (
            <p style={{ color: 'var(--red)', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
              {errorMessage}
            </p>
          )}
          <Button
            fullWidth
            disabled={pending}
            onClick={completeOnboarding}
          >
            {pending ? '저장 중...' : '온보딩 완료'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        예시 뉴스와 예시 법안이 함께 포함된 12장을 제공합니다.
      </p>

      <div style={gridStyle}>
        {cards.map((card) => (
          <ExampleCard
            key={card.card_id}
            type={card.card_type}
            category={`${card.big_category}/${card.sub_category}`}
            title={card.title}
            description={card.description}
            selected={checkedIds.includes(card.card_id)}
            onClick={() => toggleCard(card.card_id)}
          />
        ))}
      </div>
    </SetupLayout>
  );
}

