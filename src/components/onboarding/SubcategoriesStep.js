'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import SetupLayout from '@/components/setup/SetupLayout';
import SelectCard from '@/components/setup/SelectCard';
import { getSubCategoriesForBigCategory } from '@/lib/constants/categories';

import styles from './SubcategoriesStep.module.css';

const REQUIRED_TOTAL = 5;

function buildInitialSelectedByBig(bigCategories, initialSelections) {
  const base = {};

  bigCategories.forEach((bigCategory) => {
    base[bigCategory] = [];
  });

  initialSelections.forEach((selection) => {
    if (!base[selection.big_category]) {
      return;
    }

    if (base[selection.big_category].includes(selection.sub_category)) {
      return;
    }

    base[selection.big_category].push(selection.sub_category);
  });

  return base;
}

export default function SubcategoriesStep({
  bigCategories,
  initialSelections,
  editMode = false,
}) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(bigCategories[0]);

  // Ensure selectedByBig has keys for all bigCategories
  const [selectedByBig, setSelectedByBig] = useState(
    buildInitialSelectedByBig(bigCategories, initialSelections),
  );
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const totalSelected = useMemo(
    () => bigCategories.reduce((sum, bigCategory) => sum + (selectedByBig[bigCategory]?.length ?? 0), 0),
    [bigCategories, selectedByBig],
  );

  const limitByBig = useMemo(() => {
    const result = {};
    bigCategories.forEach((bigCategory) => {
      result[bigCategory] = 2;
    });
    return result;
  }, [bigCategories]);

  const distributionValid = useMemo(() => {
    if (totalSelected !== REQUIRED_TOTAL) {
      return false;
    }

    return bigCategories.every((bigCategory) => {
      const selectedCount = selectedByBig[bigCategory]?.length ?? 0;
      return selectedCount >= 1 && selectedCount <= limitByBig[bigCategory];
    });
  }, [bigCategories, limitByBig, selectedByBig, totalSelected]);

  function toggleSubCategory(bigCategory, subCategory) {
    setErrorMessage('');

    setSelectedByBig((current) => {
      const currentTotal = bigCategories.reduce(
        (sum, category) => sum + (current[category]?.length ?? 0),
        0,
      );
      const currentSelected = current[bigCategory] ?? [];
      const alreadySelected = currentSelected.includes(subCategory);

      if (alreadySelected) {
        return {
          ...current,
          [bigCategory]: currentSelected.filter((item) => item !== subCategory),
        };
      }

      if (currentSelected.length >= limitByBig[bigCategory]) {
        setErrorMessage(`${bigCategory}은(는) 2개까지만 선택할 수 있습니다.`);
        return current;
      }

      if (currentTotal >= REQUIRED_TOTAL) {
        setErrorMessage('총 5개까지만 선택할 수 있습니다.');
        return current;
      }

      return {
        ...current,
        [bigCategory]: [...currentSelected, subCategory],
      };
    });
  }

  async function handleNext() {
    if (!distributionValid) {
      const issues = bigCategories.filter(
        (cat) => (selectedByBig[cat]?.length ?? 0) < 1 || (selectedByBig[cat]?.length ?? 0) > limitByBig[cat],
      );
      if (issues.length > 0) {
        const issueTexts = issues.map((cat) => `${cat}(1~${limitByBig[cat]}개)`);
        setErrorMessage(`다음 분야의 선택 개수를 확인해주세요: ${issueTexts.join(', ')}`);
      } else {
        setErrorMessage('각 분야 1~2개, 총 5개가 되도록 선택해주세요.');
      }
      return;
    }

    const onePickBigCategory = bigCategories.find(
      (bigCategory) => (selectedByBig[bigCategory]?.length ?? 0) === 1,
    );

    if (!onePickBigCategory) {
      setErrorMessage('총 5개 선택 시 한 분야는 반드시 1개가 되어야 합니다.');
      return;
    }

    const flattenedSelections = bigCategories.flatMap((bigCategory) =>
      (selectedByBig[bigCategory] ?? []).map((subCategory) => ({
        big_category: bigCategory,
        sub_category: subCategory,
      })),
    );

    setPending(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/onboarding/subcategories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          onePickBigCategory,
          selections: flattenedSelections,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? '소분류 저장에 실패했습니다.');
      }

      const nextPath = editMode ? '/setup/examples?edit=1' : '/setup/examples';
      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error?.message ?? '소분류 저장 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  }

  function handleBack() {
    const prevPath = editMode ? '/setup/categories?edit=1' : '/setup/categories';
    router.push(prevPath);
  }

  const currentSubCategories = getSubCategoriesForBigCategory(activeTab);

  return (
    <SetupLayout
      step={2}
      title={'세부 주제를\n설정해볼까요?'}
      description="선택한 분야의 주요 키워드를 정합니다."
      currentCount={totalSelected}
      totalCount={5}
      bottomContent={
        <>
          {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
          <Button
            fullWidth
            disabled={!distributionValid || pending}
            onClick={handleNext}
          >
            {pending ? '저장 중...' : '다음으로'}
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: '16px' }}>
        <Button variant='outline' size='sm' onClick={handleBack}>
          뒤로가기
        </Button>
      </div>
      <div className={styles.tabsScroll}>
        {bigCategories.map((bigCategory) => {
          const count = selectedByBig[bigCategory]?.length ?? 0;
          const limit = limitByBig[bigCategory];

          return (
            <button
              key={bigCategory}
              type="button"
              className={`${styles.tab} ${activeTab === bigCategory ? styles.active : ''}`}
              onClick={() => setActiveTab(bigCategory)}
            >
              {bigCategory}
              <span className={styles.tabCount}>
                {count === 0 && activeTab !== bigCategory ? '' : `${count}/${limit}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className={styles.limitNote}>
        각 분야에서 1~2개씩 선택하고, 총 5개를 맞춰주세요.
      </p>

      <div className={styles.grid}>
        {currentSubCategories.map((subCategory) => (
          <SelectCard
            key={subCategory}
            label={subCategory}
            selected={(selectedByBig[activeTab] ?? []).includes(subCategory)}
            onClick={() => toggleSubCategory(activeTab, subCategory)}
            disabled={
              !(selectedByBig[activeTab] ?? []).includes(subCategory) &&
              (selectedByBig[activeTab]?.length ?? 0) >= limitByBig[activeTab]
            }
          />
        ))}
      </div>
    </SetupLayout>
  );
}
