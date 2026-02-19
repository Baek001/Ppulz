export const runtime = 'edge';
import ExamplesStep from '@/components/onboarding/ExamplesStep';

const MOCK_CARDS = [
    { card_id: '1', card_type: 'news', big_category: '경제/금융', sub_category: '증권/주식', title: '코스피 외인 매도세에 2500선 붕괴 위험', description: '미국발 금리 인상 우려가 지속되면서 국내 증시가 약세를 보이고 있다.' },
    { card_id: '2', card_type: 'news', big_category: '경제/금융', sub_category: '부동산', title: '서울 아파트값 3주 연속 하락세', description: '거래 절벽이 이어지는 가운데 급매물 위주로 거래가 이루어지고 있다.' },
    { card_id: '3', card_type: 'bill', big_category: '정치/행정', sub_category: '국회/정당', title: '전세사기 피해 지원 특별법 개정안 발의', description: '피해자 인정 범위를 확대하고 지원책을 강화하는 내용을 담고 있다.' },
    { card_id: '4', card_type: 'bill', big_category: 'IT/과학', sub_category: '모바일', title: '단통법 폐지안 국무회의 통과', description: '이동통신 단말장치 유통구조 개선에 관한 법률 폐지안이 의결되었다.' },
    { card_id: '5', card_type: 'news', big_category: '사회/노동', sub_category: '인권/복지', title: '저출산 대책, 현금 지원 효과 있을까?', description: '전문가들은 현금 지원보다는 양육 환경 조성이 시급하다고 지적한다.' },
    { card_id: '6', card_type: 'news', big_category: '생활/문화', sub_category: '건강', title: '환절기 독감 주의보... 예방접종 필수', description: '일교차가 커지면서 독감 환자가 급증하고 있다.' },
];

export default function TestExamplesPage() {
    return <ExamplesStep cards={MOCK_CARDS} initialChecked={['1', '3', '4']} />;
}
