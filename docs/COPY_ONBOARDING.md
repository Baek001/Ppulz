# PPulse Onboarding Copy

## 1. Categories (`/setup/categories`)
- **Step**: 1/3
- **Title**: 관심 있는 분야를\n선택해주세요
- **Description**: 가장 먼저 보고 싶은 3가지를 골라주세요.
- **Counter**: `{n}개 선택됨 / 3개`
- **Card Labels**: (Existing Data)
- **Button (Disabled)**: 3개를 선택해주세요
- **Button (Active)**: 다음으로

## 2. Subcategories (`/setup/subcategories`)
- **Step**: 2/3
- **Title**: 세부 주제를\n설정해볼까요?
- **Description**: 선택한 분야의 주요 키워드를 정합니다.
- **Section Header**: `{CategoryName}`
- **Instruction (Toggle/Option)**: 이 분야는 1개만 선택하기
- **Counter**: `{n}개 선택됨 / 5개` (Global) | 이 분야 `{n}/2` (Local)
- **Button**: 다음으로

## 3. Examples (`/setup/examples`)
- **Step**: 3/3
- **Title**: 어떤 스타일의 뉴스를\n원하시나요?
- **Description**: 관심 가는 예시를 최대 6개까지 체크해주세요.
- **Counter**: `{n}개 선택됨 / 6개`
- **Card Content**: (Dynamic Data)
- **Button**: 완료하기

## 4. Errors & Empty States
- **Limit Reached**: "최대 {n}개까지 선택할 수 있어요."
- **Min Requirement**: "최소 {n}개를 선택해야 해요."
