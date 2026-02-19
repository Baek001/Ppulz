export const runtime = 'edge';
import SubcategoriesStep from '@/components/onboarding/SubcategoriesStep';

export default function TestSubcategoriesPage() {
    const bigCategories = ['寃쎌젣/湲덉쑖', '?뺤튂/?됱젙', 'IT/怨쇳븰']; // 3 selected
    // Mock selections: 
    // 寃쎌젣/湲덉쑖: 2 items
    // ?뺤튂/?됱젙: 2 items
    // IT/怨쇳븰: 1 item (Wait, user picks 1-pick category)
    // Let's say initialOnePick is IT/怨쇳븰.

    // We need mock initial selections
    const initialSelections = [
        { big_category: '寃쎌젣/湲덉쑖', sub_category: '利앷텒/二쇱떇' },
        { big_category: '寃쎌젣/湲덉쑖', sub_category: '遺?숈궛' },
        { big_category: '?뺤튂/?됱젙', sub_category: '援?쉶/?뺣떦' },
        { big_category: '?뺤튂/?됱젙', sub_category: '?됱젙' },
        { big_category: 'IT/怨쇳븰', sub_category: '紐⑤컮?? },
    ];

    return (
        <SubcategoriesStep
            bigCategories={bigCategories}
            initialSelections={initialSelections}
            initialOnePickBigCategory={'IT/怨쇳븰'}
        />
    );
}

