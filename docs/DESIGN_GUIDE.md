# PPulse Design Guide

## 1. Color Palette

### Brand Colors
- **Primary Blue**: `#3182F6` (Brand Identity, Actions)
- **Primary Hover**: `#1B64DA`
- **Secondary**: `#E8F3FF` (Light Point Backgrounds)

### Status Colors (Graph)
- **High Score (Positive)**: `#05C271` (Green)
- **Mid Score (Neutral)**: `#FFB800` (Yellow)
- **Low Score (Negative)**: `#F04452` (Red)

### Backgrounds
- **Main Background**: `#F2F4F6` (Light Gray)
- **Surface (Card/White)**: `#FFFFFF`
- **Surface Alt**: `#F9FAFB`

### Text Colors
- **Main Text**: `#191F28`
- **Sub Text**: `#4E5968`
- **Muted Text**: `#8B95A1`
- **White Text**: `#FFFFFF`

---

## 2. Typography

**Font Family**: `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", Roboto, "Noto Sans KR", sans-serif`

### Headings
- **Hero Title**: 56px / ExtraBold (800)
- **Section Title**: 40px / ExtraBold (800)
- **Card Title**: 24px / Bold (700)

### Body
- **Lead/Description**: 20px / Normal
- **Body Main**: 16px-18px / Normal
- **Body Sub**: 14px / Normal
- **Caption**: 13px / Normal

---

## 3. Spacing & Layout

### Grid
- **Container Max Width**: `1200px`
- **Container Padding**: `0 20px`

### Spacing Tokens
- **Section Padding**: `100px 0` (Hero: `160px 0`)
- **Card Gap**: `30px`

### Radius
- **Small**: `8px` (Buttons, Bars)
- **Medium**: `12px`
- **Large**: `20px`
- **X-Large**: `24px` (Cards)

---

## 4. UI Elements

### Buttons
- **Primary**: Blue background, White text, 12px radius.
- **Outline**: Transparent background, Border, Main text.
- **Ghost**: Transparent background, Sub text.
- **Hover**: Opacity change or slight background darkening.

### Cards
- **Style**: White background, 24px radius, Drop shadow.
- **Hover Effect**: `translateY(-4px)` + Increased shadow (`--shadow-md`).
