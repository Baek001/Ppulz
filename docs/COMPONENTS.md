# Components Documentation

## UI Components (`src/components/ui/`)

### 1. Button (`Button.js`)
Generic button component used for actions.

**Props:**
- `children`: ReactNode (Text/Label)
- `variant`: `'primary' | 'secondary' | 'outline' | 'ghost'` (Default: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (Default: `'md'`)
- `fullWidth`: `boolean`
- `onClick`: `function`

### 2. Card (`Card.js`)
Container component with standard styling (background, shadow, radius).

**Props:**
- `children`: ReactNode
- `hover`: `boolean` (Enable hover animation)
- `className`: `string` (Additional classes)

---

## Layout Components (`src/components/layout/`)

### 1. Header (`Header.js`)
Fixed top navigation bar.
- **Features**: Glassmorphism effect (`backdrop-filter`), Responsive navigation (hidden on mobile), Login/Start buttons.

### 2. Footer (`Footer.js`)
Site footer.
- **Features**: Logo, Service Description, Link Columns (Service, Support), Copyright, Legal Links.

---

## Section Components (`src/components/sections/`)

### 1. Hero (`Hero.js`)
First screen impression.
- **Contains**: `DemoGraph` component.
- **Layout**: Text left, Visual right (Desktop). Stacked (Mobile).

### 2. DemoGraph (`DemoGraph.js`)
Interactive mockup of the main service value.
- **Function**: Click tabs to switch mock data categories.
- **Visuals**: Animated bar chart + Score display.
- **State**: Tracks `activeTab` to render `MOCK_DATA`.

### 3. HowToUse (`HowToUse.js`)
3-Step guide.
- **Layout**: 3-Column Grid.

### 4. Features (`Features.js`)
Key benefits grid.
- **Layout**: 2x2 Grid.

### 5. Trust (`Trust.js`)
Reliability & Disclaimer.
- **Layout**: Centered text + Disclaimer Box.
