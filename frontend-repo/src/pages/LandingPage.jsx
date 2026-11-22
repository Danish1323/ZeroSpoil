import React from 'react';
import Logo from '../components/Logo';

const styles = {
  root: {
    minHeight: '100vh',
    /* Smooth vertical green gradient from deep, dark forest green to fresh mint */
    background: 'linear-gradient(180deg, #091a10 0%, #0f2d1a 38%, #1b4d2e 72%, #38784d 90%, #a7f3d0 100%)',
    backgroundAttachment: 'fixed',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 48px',
    background: 'rgba(9, 26, 16, 0.45)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(134, 239, 172, 0.15)',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  loginBtn: {
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1.5px solid rgba(167, 243, 208, 0.4)',
    borderRadius: 24,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.2s',
  },
  openBtn: {
    /* Lighter green shade that stands out against the dark top gradient */
    background: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 50%, #34d399 100%)',
    border: 'none',
    borderRadius: 24,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 800,
    color: '#062d16',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(52, 211, 153, 0.35)',
    transition: 'all 0.2s',
  },
  hero: {
    textAlign: 'center',
    padding: '80px 24px 60px',
    maxWidth: 900,
    margin: '0 auto',
  },
  heroTitle: {
    /* Elegant, fresh editorial display typography */
    fontFamily: '"Plus Jakarta Sans", "Cabinet Grotesk", "Inter", -apple-system, sans-serif',
    fontSize: 'clamp(38px, 7vw, 68px)',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.035em',
    color: '#f8fafc',
    textShadow: '0 2px 24px rgba(0, 0, 0, 0.3)',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    maxWidth: 960,
    margin: '0 auto',
    padding: '0 48px 80px',
  },
  card: (active) => ({
    background: active ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(12px)',
    borderRadius: 16,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 48,
    boxShadow: active
      ? '0 12px 30px rgba(9, 26, 16, 0.25), 0 0 0 2px #34d399'
      : '0 6px 20px rgba(9, 26, 16, 0.18)',
    cursor: 'pointer',
    border: active ? '2px solid #34d399' : '2px solid rgba(200, 207, 196, 0.6)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: active ? 'translateY(-2px)' : 'none',
  }),
  iconBox: {
    width: 44,
    height: 44,
    background: 'linear-gradient(135deg, #eaf2e5 0%, #d8e5d1 100%)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(15, 45, 26, 0.08)',
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: 700,
    color: '#0d0d0d',
    letterSpacing: '-0.01em',
  },
};

function CategoryCard({ icon, label, active }) {
  return (
    <div style={styles.card(active)}>
      <div style={styles.iconBox}>{icon}</div>
      <span style={styles.cardLabel}>{label}</span>
    </div>
  );
}

export default function LandingPage({ onLogin }) {
  return (
    <div style={styles.root}>
      <nav style={styles.nav}>
        <Logo size={28} dark={true} />
        <div style={styles.navRight}>
          <button style={styles.loginBtn} onClick={onLogin}>Log In</button>
          <button style={styles.openBtn} onClick={onLogin}>Open App</button>
        </div>
      </nav>

      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>
          Rescue tonight's fresh surplus food near you for 50% off—or claim free NGO pickups.
        </h1>
      </div>

      <div style={styles.cards}>
        <CategoryCard
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#0f2d1a" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
          label="Supermarkets"
          active={false}
        />
        <CategoryCard
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#0f2d1a" strokeWidth="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          }
          label="Local Bakeries & Stalls"
          active={true}
        />
        <CategoryCard
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#0f2d1a" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          }
          label="Community & NGOs"
          active={false}
        />
      </div>
    </div>
  );
}
