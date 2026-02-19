export const runtime = 'edge';
import SubcategoriesStep from '@/components/onboarding/SubcategoriesStep';

export default function TestSubcategoriesPage() {
    const bigCategories = ['경제/금융', '정치/행정', 'IT/과학']; // 3 selected
    // Mock selections: 
    // 경제/금융: 2 items
    // 정치/행정: 2 items
    // IT/과학: 1 item (Wait, user picks 1-pick category)
    // Let's say initialOnePick is IT/과학.

    // We need mock initial selections
    const initialSelections = [
        { big_category: '경제/금융', sub_category: '증권/주식' },
        { big_category: '경제/금융', sub_category: '부동산' },
        { big_category: '정치/행정', sub_category: '국회/정당' },
        { big_category: '정치/행정', sub_category: '행정' },
        { big_category: 'IT/과학', sub_category: '모바일' },
    ];

    return (
        <SubcategoriesStep
            bigCategories={bigCategories}
            initialSelections={initialSelections}
            initialOnePickBigCategory={'IT/과학'}
        />
    );
}
