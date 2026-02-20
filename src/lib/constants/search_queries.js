export const SEARCH_QUERIES = {
  // 금융자산
  '주식': {
    KR: '주식 OR 증시 OR 코스피 OR 코스닥 OR 실적 OR 공시',
    US: 'stock OR stocks OR equities OR earnings OR SEC filing OR guidance',
  },
  '채권': {
    KR: '채권 OR 국채 OR 회사채 OR 금리 OR 신용등급',
    US: 'bond OR treasury OR corporate bond OR yield OR credit rating',
  },
  'ETF': {
    KR: 'ETF OR 상장지수펀드 OR 지수추종 OR 테마 ETF',
    US: 'ETF OR index fund OR sector ETF OR thematic ETF',
  },
  '금리': {
    KR: '금리 OR 기준금리 OR 인상 OR 인하 OR 물가 OR 통화정책',
    US: 'interest rate OR rate hike OR rate cut OR inflation OR Fed OR monetary policy',
  },
  '외환': {
    KR: '환율 OR 달러 OR 원화 약세 OR 외환시장 OR 헤지',
    US: 'FX OR exchange rate OR dollar strength OR currency market OR hedging',
  },
  '파생': {
    KR: '선물 OR 옵션 OR 변동성 OR 증거금 OR 파생상품',
    US: 'futures OR options OR volatility OR margin OR derivatives',
  },

  // 디지털자산
  '코인': {
    KR: '가상자산 OR 코인 OR 암호화폐 OR 비트코인 OR 이더리움',
    US: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR altcoin',
  },
  '스테이블코인': {
    KR: '스테이블코인 OR 준비금 OR 디페깅 OR 발행 OR 상환',
    US: 'stablecoin OR reserves OR depeg OR issuance OR redemption',
  },
  '거래소': {
    KR: '거래소 OR 상장 OR 상폐 OR 수수료 OR 현물거래',
    US: 'crypto exchange OR listing OR delisting OR trading fees OR spot trading',
  },
  '디파이': {
    KR: '디파이 OR 예치 OR 대출 OR DEX OR 유동성',
    US: 'DeFi OR lending OR borrowing OR DEX OR liquidity',
  },
  '지갑': {
    KR: '지갑 OR 개인지갑 OR 콜드월렛 OR 키관리 OR 전송수수료',
    US: 'wallet OR self custody OR cold wallet OR key management',
  },
  '보안': {
    KR: '해킹 OR 취약점 OR 보안사고 OR 도난 OR 감사',
    US: 'hack OR exploit OR security breach OR stolen funds OR vulnerability',
  },

  // 실물상품소비
  '식품': {
    KR: '식품 OR 식료품 가격 OR 식품안전 OR 원산지 OR 물가',
    US: 'food OR commodity price OR food safety OR labeling OR inflation',
  },
  '유통': {
    KR: '유통 OR 이커머스 OR 배송비 OR 수수료 OR 할인',
    US: 'retail OR e commerce OR delivery fee OR platform fee OR discount',
  },
  '전자제품': {
    KR: '전자제품 OR 부품 OR 인증 OR 리콜 OR 출시',
    US: 'electronics OR components OR certification OR recall OR product launch',
  },
  '화장품': {
    KR: '화장품 OR 표시광고 OR 성분 OR 수출 OR 인증',
    US: 'cosmetics OR labeling OR ingredients OR export OR certification',
  },
  '생활용품': {
    KR: '생활용품 OR 안전기준 OR 인증 OR 리콜',
    US: 'consumer goods OR safety standard OR certification OR recall',
  },
  '리콜': {
    KR: '리콜 OR 결함 OR 안전사고 OR 환불 OR 교환',
    US: 'recall OR defect OR safety incident OR refund OR replacement',
  },

  // 부동산인프라
  '주거': {
    KR: '주택 OR 전세 OR 매매 OR 대출규제 OR 금리',
    US: 'housing OR home price OR mortgage OR rent OR housing policy',
  },
  '상업용': {
    KR: '상업용 부동산 OR 오피스 OR 공실 OR 임대료',
    US: 'commercial real estate OR office vacancy OR rent OR cap rate',
  },
  '임대차': {
    KR: '임대차 OR 전월세 OR 계약갱신 OR 임대료',
    US: 'lease OR rental contract OR rent increase OR tenant protection',
  },
  '재건축': {
    KR: '재건축 OR 안전진단 OR 인허가 OR 규제 완화',
    US: 'redevelopment OR zoning OR permit OR urban renewal',
  },
  '재개발': {
    KR: '재개발 OR 정비사업 OR 인허가 OR 조합',
    US: 'urban redevelopment OR renewal project OR permit',
  },
  'PF': {
    KR: 'PF OR 프로젝트파이낸싱 OR 브릿지론 OR 디폴트',
    US: 'project finance OR construction loan OR default risk',
  },

  // 에너지환경
  '전력': {
    KR: '전기요금 OR 전력시장 OR 발전 OR 송배전',
    US: 'electricity price OR power market OR generation OR grid',
  },
  '가스': {
    KR: '가스요금 OR LNG OR 저장 OR 수입 단가',
    US: 'natural gas price OR LNG OR storage OR import cost',
  },
  '석유': {
    KR: '유가 OR 원유 OR 정유 OR 재고',
    US: 'oil price OR crude OR refinery margin OR inventory',
  },
  '신재생': {
    KR: '신재생 OR 태양광 OR 풍력 OR 보조금 OR 계통연계',
    US: 'renewable energy OR solar OR wind OR subsidy OR grid interconnection',
  },
  '탄소': {
    KR: '탄소 OR 배출권 OR 탄소중립 OR 규제 강화',
    US: 'carbon OR emissions trading OR net zero OR carbon regulation',
  },
  '광물': {
    KR: '핵심광물 OR 리튬 OR 니켈 OR 공급망',
    US: 'critical minerals OR lithium OR nickel OR supply chain',
  },

  // 산업기술규제
  'AI': {
    KR: 'AI 규제 OR AI 안전 OR AI 책임 OR 가이드라인',
    US: 'AI regulation OR AI safety OR liability OR AI governance',
  },
  '데이터': {
    KR: '데이터 활용 OR 데이터 거버넌스 OR 데이터 규제 OR 데이터 보안',
    US: 'data governance OR data sharing OR data regulation OR data security',
  },
  '개인정보': {
    KR: '개인정보 OR 동의 OR 국외이전 OR 벌칙 OR 프라이버시',
    US: 'privacy OR personal data OR consent OR penalties',
  },
  '플랫폼': {
    KR: '플랫폼 규제 OR 수수료 OR 공정 OR 알고리즘',
    US: 'platform regulation OR antitrust OR fees OR algorithm transparency',
  },
  '반도체': {
    KR: '반도체 OR 공급망 OR 보조금 OR 수출 규제',
    US: 'semiconductors OR supply chain OR subsidy OR export controls',
  },
  '수출통제': {
    KR: '수출통제 OR 제재 OR 허가 OR 제한',
    US: 'export controls OR sanctions OR licensing OR restriction',
  },

  // 모빌리티물류
  '자동차': {
    KR: '자동차 OR 안전기준 OR 인증 OR 리콜 OR 배출 규제',
    US: 'auto OR vehicle safety OR certification OR recall OR emissions regulation',
  },
  '전기차': {
    KR: '전기차 OR 보조금 OR 충전 인프라 OR 배터리 안전',
    US: 'EV OR subsidy OR charging infrastructure OR battery safety',
  },
  '배터리': {
    KR: '배터리 OR 원재료 OR 화재 OR 재활용 OR 공급망',
    US: 'battery OR materials OR fire risk OR recycling OR supply chain',
  },
  '자율주행': {
    KR: '자율주행 OR 테스트 OR 책임 OR 규제 OR 센서',
    US: 'autonomous driving OR testing permit OR liability OR regulation',
  },
  '항공': {
    KR: '항공 OR 운임 OR 안전 점검 OR 지연 OR 수요',
    US: 'airline OR airfare OR safety inspection OR delay OR demand',
  },
  '해운': {
    KR: '해운 OR 운임 OR 항만 혼잡 OR 물류 지연 OR IMO 규제',
    US: 'shipping OR freight rate OR port congestion OR logistics delay OR IMO regulation',
  },

  // 공공사회
  '세제': {
    KR: '세율 OR 공제 OR 세제 개편 OR 세법',
    US: 'tax rate OR deduction OR tax reform OR IRS',
  },
  '노동': {
    KR: '노동 OR 근로시간 OR 최저임금 OR 고용',
    US: 'labor law OR minimum wage OR workplace safety OR employment',
  },
  '보건': {
    KR: '보건 OR 건강보험 OR 보건정책 OR 병원',
    US: 'healthcare policy OR insurance coverage OR public health',
  },
  '교육': {
    KR: '교육 정책 OR 예산 OR 커리큘럼 OR 디지털 학습',
    US: 'education policy OR budget OR curriculum reform OR digital learning',
  },
  '재난안전': {
    KR: '재난 OR 안전 점검 OR 보험 보상 OR 비상 대응',
    US: 'disaster response OR safety inspection OR emergency management OR insurance',
  },
  '국방': {
    KR: '국방 예산 OR 조달 OR 방위산업 OR 안보 정책',
    US: 'defense budget OR procurement OR security policy OR defense industry',
  },
};
