export const SEARCH_QUERIES = {
    // 8.1 금융자산
    '주식': {
        KR: '주식 OR 증시 OR 코스피 OR 코스닥 OR 실적 OR 공시',
        US: 'stock OR stocks OR equities OR earnings OR SEC filing OR guidance'
    },
    '채권': {
        KR: '채권 OR 국채 OR 회사채 OR 금리차 OR 스프레드 OR 신용등급',
        US: 'bond OR bonds OR treasury OR corporate bond OR spread OR credit rating'
    },
    'ETF': {
        KR: 'ETF OR 상장지수 OR 지수추종 OR 리밸런싱 OR 테마 ETF',
        US: 'ETF OR index fund OR rebalancing OR sector ETF OR thematic ETF'
    },
    '금리': {
        KR: '기준금리 OR 금리인상 OR 금리인하 OR 물가 OR 인플레이션 OR 통화정책',
        US: 'interest rate OR rate hike OR rate cut OR inflation OR Fed OR monetary policy'
    },
    '외환': {
        KR: '환율 OR 달러원 OR 달러 강세 OR 원화 약세 OR 외환시장 OR 환헤지',
        US: 'FX OR exchange rate OR dollar strength OR currency market OR hedging'
    },
    '파생': {
        KR: '선물 OR 옵션 OR 변동성 OR 증거금 OR 헤지 OR 파생상품',
        US: 'futures OR options OR volatility OR margin requirement OR hedging OR derivatives'
    },

    // 8.2 디지털자산
    '코인': {
        KR: '가상자산 OR 코인 OR 알트코인 OR 시세 변동 OR 비트코인 OR 이더리움',
        US: 'crypto OR cryptocurrency OR altcoin OR Bitcoin OR Ethereum OR price volatility'
    },
    '스테이블코인': {
        KR: '스테이블코인 OR 준비금 OR 디페그 OR 발행 OR 상환 OR 결제',
        US: 'stablecoin OR reserves OR depeg OR issuance OR redemption OR payments'
    },
    '거래소': {
        KR: '거래소 OR 상장 OR 상폐 OR 수수료 OR 현물거래 OR 파생거래',
        US: 'crypto exchange OR listing OR delisting OR trading fees OR spot trading OR derivatives'
    },
    '디파이': {
        KR: '디파이 OR 예치 OR 대출 OR 덱스 OR 유동성 OR 청산',
        US: 'DeFi OR lending OR borrowing OR DEX OR liquidity OR liquidation'
    },
    '지갑': {
        KR: '지갑 OR 개인지갑 OR 콜드월렛 OR 키관리 OR 전송 수수료',
        US: 'wallet OR self custody OR cold wallet OR key management OR transfer fee'
    },
    '보안': {
        KR: '해킹 OR 취약점 OR 보안사고 OR 탈취 OR 침해 OR 감사',
        US: 'hack OR exploit OR security breach OR stolen funds OR vulnerability OR audit'
    },

    // 8.3 실물상품소비
    '식품': {
        KR: '식품 OR 원재료 가격 OR 원산지 OR 식품 안전 OR 물가 OR 공급',
        US: 'food OR commodity price OR food safety OR origin labeling OR inflation OR supply'
    },
    '유통': {
        KR: '유통 OR 이커머스 OR 배송비 OR 수수료 OR 할인 OR 재고',
        US: 'retail OR e commerce OR delivery fee OR platform fee OR discount OR inventory'
    },
    '전자제품': {
        KR: '전자제품 OR 반도체 수급 OR 부품 OR 인증 OR 리콜 OR 출시',
        US: 'electronics OR components OR supply chain OR certification OR recall OR product launch'
    },
    '화장품': {
        KR: '화장품 OR 표시광고 OR 성분 OR 수출 OR 인증 OR 규제',
        US: 'cosmetics OR labeling OR ingredients OR export OR certification OR regulation'
    },
    '생활용품': {
        KR: '생활용품 OR 안전기준 OR 유해성 OR 인증 OR 원산지 OR 리콜',
        US: 'consumer goods OR safety standard OR certification OR recall OR origin labeling'
    },
    '리콜': {
        KR: '리콜 OR 결함 OR 안전사고 OR 품질 문제 OR 환불 OR 교환',
        US: 'recall OR defect OR safety incident OR quality issue OR refund OR replacement'
    },

    // 8.4 부동산인프라
    '주거': {
        KR: '주택 OR 아파트 OR 전세 OR 매매 OR 대출 규제 OR 금리',
        US: 'housing OR home price OR mortgage OR rent OR housing policy OR interest rate'
    },
    '상업용': {
        KR: '상업용 부동산 OR 오피스 OR 공실 OR 임대료 OR 수익률 OR 캡레이트',
        US: 'commercial real estate OR office vacancy OR rent OR cap rate OR yield'
    },
    '임대차': {
        KR: '임대차 OR 전월세 OR 보증금 OR 계약갱신 OR 임대료 OR 분쟁',
        US: 'lease OR rental contract OR deposit OR rent increase OR tenant protection'
    },
    '재건축': {
        KR: '재건축 OR 안전진단 OR 인허가 OR 규제 완화 OR 부담금 OR 조합',
        US: 'redevelopment OR zoning OR permit OR safety inspection OR urban renewal'
    },
    '재개발': {
        KR: '재개발 OR 정비사업 OR 인허가 OR 사업성 OR 조합 OR 공공참여',
        US: 'urban redevelopment OR renewal project OR permit OR project feasibility OR public participation'
    },
    'PF': {
        KR: 'PF OR 프로젝트파이낸싱 OR 브릿지론 OR 유동성 OR 연체 OR 보증',
        US: 'project finance OR construction loan OR liquidity OR default risk OR guarantee'
    },

    // 8.5 에너지환경
    '전력': {
        KR: '전기요금 OR 전력시장 OR 발전 OR 예비력 OR 계통 OR 정산',
        US: 'electricity price OR power market OR generation OR grid OR capacity OR settlement'
    },
    '가스': {
        KR: '가스요금 OR LNG OR 재고 OR 수입 단가 OR 공급 OR 도시가스',
        US: 'natural gas price OR LNG OR storage OR import cost OR supply'
    },
    '석유': {
        KR: '유가 OR 정유 OR 재고 OR 산유국 OR 원유 OR 마진',
        US: 'oil price OR crude OR refinery margin OR inventory OR OPEC'
    },
    '신재생': {
        KR: '신재생 OR 태양광 OR 풍력 OR 보조금 OR 계통연계 OR 발전사업',
        US: 'renewable energy OR solar OR wind OR subsidy OR grid interconnection'
    },
    '탄소': {
        KR: '탄소 OR 배출권 OR 탄소중립 OR 규제 강화 OR 감축 OR ETS',
        US: 'carbon OR emissions trading OR net zero OR carbon regulation OR ETS'
    },
    '광물': {
        KR: '핵심광물 OR 리튬 OR 니켈 OR 공급망 OR 자원안보 OR 수입규제',
        US: 'critical minerals OR lithium OR nickel OR supply chain OR resource security'
    },

    // 8.6 산업기술규제
    'AI': {
        KR: 'AI 규제 OR AI 안전 OR AI 검증 OR 책임 OR 가이드라인 OR 인공지능',
        US: 'AI regulation OR AI safety OR liability OR AI governance' // shortened for brevity if needed
    },
    '데이터': {
        KR: '데이터 활용 OR 데이터 결합 OR 데이터 이동 OR 데이터 규정 OR 데이터 보안',
        US: 'data governance OR data sharing OR data portability OR data regulation OR data security'
    },
    '개인정보': {
        KR: '개인정보 OR 동의 OR 국외이전 OR 벌칙 OR 처리 기준 OR 프라이버시',
        US: 'privacy OR personal data OR consent OR cross border transfer OR penalties'
    },
    '플랫폼': {
        KR: '플랫폼 규제 OR 수수료 OR 독점 OR 공정 OR 입점 OR 알고리즘',
        US: 'platform regulation OR antitrust OR fees OR marketplace OR algorithm transparency'
    },
    '반도체': {
        KR: '반도체 OR 공급망 OR 보조금 OR 수출 규제 OR 재고 OR 설비투자',
        US: 'semiconductors OR supply chain OR subsidy OR export controls OR inventory'
    },
    '수출통제': {
        KR: '수출통제 OR 제재 OR 허가 OR 규정 강화 OR 수출 제한 OR 통관',
        US: 'export controls OR sanctions OR licensing OR restriction OR compliance'
    },

    // 8.7 모빌리티물류
    '자동차': {
        KR: '자동차 OR 안전기준 OR 인증 OR 리콜 OR 부품 OR 배출 규제',
        US: 'auto OR vehicle safety OR certification OR recall OR emissions regulation'
    },
    '전기차': {
        KR: '전기차 OR 보조금 OR 충전 인프라 OR 배터리 안전 OR 판매 둔화',
        US: 'EV OR subsidy OR charging infrastructure OR battery safety OR sales slowdown'
    },
    '배터리': {
        KR: '배터리 OR 원재료 OR 화재 OR 인증 OR 재활용 OR 공급망',
        US: 'battery OR materials OR fire risk OR certification OR recycling OR supply chain'
    },
    '자율주행': {
        KR: '자율주행 OR 실증 OR 사고 책임 OR 규제 OR 지도 데이터 OR 센서',
        US: 'autonomous driving OR testing permit OR liability OR regulation OR sensor'
    },
    '항공': {
        KR: '항공 OR 운임 OR 안전 점검 OR 지연 OR 연료비 OR 수요 회복',
        US: 'airline OR airfare OR safety inspection OR delay OR fuel cost OR demand'
    },
    '해운': {
        KR: '해운 OR 운임 OR 항만 OR 물류 지연 OR 환경 규제 OR 선박',
        US: 'shipping OR freight rate OR port congestion OR logistics delay OR IMO regulation'
    },

    // 8.8 공공사회
    '세제': {
        KR: '세율 OR 공제 OR 과세 OR 세액공제 OR 세법 개정 OR 부담',
        US: 'tax rate OR deduction OR tax credit OR tax reform OR IRS'
    },
    '노동': {
        KR: '노동 OR 근로시간 OR 최저임금 OR 산재 OR 고용 OR 노사',
        US: 'labor law OR minimum wage OR working hours OR workplace safety OR employment'
    },
    '보건': {
        KR: '보건 OR 건강보험 OR 급여 기준 OR 의료 정책 OR 감염 대응 OR 병원',
        US: 'healthcare policy OR insurance coverage OR reimbursement OR public health'
    },
    '교육': {
        KR: '교육 정책 OR 예산 OR 제도 개편 OR 디지털 교육 OR 입시 OR 학교',
        US: 'education policy OR budget OR curriculum reform OR digital learning'
    },
    '재난안전': {
        KR: '재난 OR 안전 점검 OR 대응 체계 OR 보험 보상 OR 위기관리',
        US: 'disaster response OR safety inspection OR emergency management OR insurance compensation'
    },
    '국방': {
        KR: '국방 예산 OR 조달 OR 무기 수출 OR 승인 OR 안보 OR 방위산업',
        US: 'defense budget OR procurement OR arms export OR security policy OR defense industry'
    },
};
