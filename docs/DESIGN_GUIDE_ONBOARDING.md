# PPulse Onboarding Design Guide

## 1. Overview
The onboarding flow follows the **PPulse Introduction Page** style:
- **Clean & Spacious**: Large whitespace, centered layout.
- **Big Typography**: Clear headings and instructions.
- **Round & Soft**: Large border radius (24px for cards, 12px for buttons).
- **Mobile-First**: Single column on mobile, max-width container on desktop.

## 2. Layout Structure
- **Container**: Max-width `600px` (centered).
- **Header (Mobile Only)**: Fixed top bar with "Step Indicator" (e.g., 1/3).
- **Content Area**:
    - **Top**: Progress Bar & Counter (Desktop/Mobile).
    - **Header**: Main Title (H1) + Description (p).
    - **Body**: Grid of selectable items.
- **Footer (Sticky)**:
    - Fixed at bottom of viewport.
    - Background: White gradient fade-in or solid white with shadow.
    - Button: Full width (Mobile) / Wide (Desktop).

## 3. Typography (Extension of Main Guide)
- **Title (H1)**: `24px` (Mobile) / `32px` (Desktop) - Weight 800.
- **Description**: `16px` (Mobile) / `18px` (Desktop) - Color `--text-sub`.
- **Card Label**: `18px` - Weight 700.
- **Counter Text**: `14px` - Color `--primary` (Active) / `--text-muted` (Inactive).

## 4. Components

### A. Selectable Card (Categories)
- **Base**: `bg-white`, `border-1px`, `radius-20px`.
- **Default**: Border `--border`, Shadow `--shadow-sm`.
- **Selected**:
    - Border: `2px solid --primary`.
    - Background: `--secondary` (Light Blue).
    - Icon: Check icon visible (Top-right or inline).
- **Disabled/Max Reached**: Opacity 0.5, grayscale (if applicable).
- **Interaction**: Scale down slightly (0.98) on click.

### B. Selection Counter (Top Right or Sticky Top)
- **Format**: `Selected / Total`.
- **Style**: Badge style or simple text.
- **Animation**: Number bump effect when changed.

### C. Example Card (News Style)
- **Layout**:
    - **Header**: Label (Issue/Bill) + Date/Source.
    - **Body**: Title (Max 2 lines) + Summary (1 line).
    - **Footer**: Keywords or empty.
- **Selection**:
    - Thick colored border (`--primary`).
    - Overlay check mark? Or Checkbox in corner.

## 5. Spacing
- **Grid Gap**: `12px` (Mobile) / `16px` (Desktop).
- **Section Padding**: `20px` horizontal.
- **Bottom Padding**: `100px` (to prevent content hiding behind sticky button).

## 6. Colors (Tokens)
- Same as Global tokens.
- **Progress Track**: `#E5E8EB`.
- **Progress Fill**: `--primary` (`#3182F6`).
