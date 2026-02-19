'use client';

import UserMenu from './UserMenu';

import styles from './Header.module.css';

const NAV_ITEMS = [
  { id: 'features', label: '기능' },
  { id: 'how-it-works', label: '사용방법' },
  { id: 'prediction-market', label: '예측마켓' },
  { id: 'faq', label: 'FAQ' },
];

const SCROLL_SPEED_PX_PER_MS = 2.6;

function animateScrollTo(targetY) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const durationMs = Math.max(1, Math.abs(distance) / SCROLL_SPEED_PX_PER_MS);
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    window.scrollTo({ top: startY + distance * progress, left: 0, behavior: 'auto' });

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

export default function Header() {
  function handleAnchorClick(event, sectionId) {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (!section) return;

    const headerOffset = 88;
    const targetY = Math.max(0, section.getBoundingClientRect().top + window.scrollY - headerOffset);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
      return;
    }

    animateScrollTo(targetY);
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.container}`}>
        <div className={styles.logo}>Ppulz</div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => handleAnchorClick(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className={`${styles.actions} ${styles.userMenuWrap}`}>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

// Trigger rebuild for env vars
