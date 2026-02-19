'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import SetupLayout from '@/components/setup/SetupLayout';
import SelectCard from '@/components/setup/SelectCard';
import { BIG_CATEGORIES } from '@/lib/constants/categories';

// Styles for the grid layout (simple enough to keep inline or use a small module)
// specialized for this step grid
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: '12px',
  width: '100%',
};

const REQUIRED_COUNT = 3;

export default function CategoriesStep({ initialSelected = [], editMode = false }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected.slice(0, REQUIRED_COUNT));
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState(false);

  function toggleCategory(bigCategory) {
    setErrorMessage('');

    if (selected.includes(bigCategory)) {
      setSelected((current) => current.filter((item) => item !== bigCategory));
      return;
    }

    if (selected.length >= REQUIRED_COUNT) {
      setErrorMessage('대분류는 3개까지만 선택할 수 있습니다.');
      return;
    }

    setSelected((current) => [...current, bigCategory]);
  }

  async function handleNext() {
    if (selected.length !== REQUIRED_COUNT) {
      setErrorMessage('정확히 3개를 선택해야 다음으로 이동할 수 있습니다.');
      return;
    }

    setPending(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/onboarding/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bigCategories: selected }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? '대분류 저장에 실패했습니다.');
      }

      const nextPath = editMode ? '/setup/subcategories?edit=1' : '/setup/subcategories';
      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error?.message ?? '대분류 저장 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <SetupLayout
      step={1}
      title={'관심 있는 분야를\n선택해주세요'}
      description="가장 먼저 보고 싶은 3가지를 골라주세요."
      currentCount={selected.length}
      totalCount={3}
      bottomContent={
        <>
          {errorMessage && (
            <p style={{ color: 'var(--red)', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
              {errorMessage}
            </p>
          )}
          <Button
            fullWidth
            disabled={selected.length !== REQUIRED_COUNT || pending}
            onClick={handleNext}
          >
            {pending ? '저장 중...' : selected.length === 3 ? '다음으로' : '3개를 선택해주세요'}
          </Button>
        </>
      }
    >
      <div style={gridStyle}>
        {BIG_CATEGORIES.map((bigCategory) => (
          <SelectCard
            key={bigCategory}
            label={bigCategory}
            selected={selected.includes(bigCategory)}
            onClick={() => toggleCategory(bigCategory)}
            disabled={!selected.includes(bigCategory) && selected.length >= REQUIRED_COUNT}
          />
        ))}
      </div>
    </SetupLayout>
  );
}
