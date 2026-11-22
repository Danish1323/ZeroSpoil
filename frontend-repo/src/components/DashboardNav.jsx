import React from 'react';
import Logo from './Logo';

const roleViews = ['Customer', 'Shop Owner', 'NGO', 'Admin'];
const subTabs = ['Agent & Safety Rails', 'WhatsApp Vendor Studio', 'Community & NGO Rescue Feed'];

export default function DashboardNav({ activeRole, setActiveRole, activeTab, setActiveTab, onReset, onLogout }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '2px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 16px rgba(15, 45, 26, 0.06)',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 28px',
      }}>
        {/* Left: Redesigned Logo + Live Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo size={28} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(135deg, #eaf2e5 0%, #dfe9d9 100%)',
            padding: '4px 12px',
            borderRadius: 20,
            border: '2px solid var(--border)',
            boxShadow: '0 2px 6px rgba(15, 45, 26, 0.05)',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--green-accent)',
              boxShadow: '0 0 8px var(--green-accent)',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-dark)', letterSpacing: '0.04em' }}>
              LIVE SYNC &bull; PANVEL
            </span>
          </div>
        </div>

        {/* Center — role switcher in lighter harmonic pill container */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: 'linear-gradient(180deg, #f2f5ed 0%, #e8ede3 100%)',
          padding: '4px',
          borderRadius: 50,
          border: '2px solid var(--border)',
          boxShadow: 'inset 0 1px 3px rgba(15, 45, 26, 0.05)',
        }}>
          {roleViews.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRole(r)}
              style={{
                padding: '7px 18px',
                borderRadius: 50,
                fontSize: 12,
                fontWeight: 700,
                background: activeRole === r ? 'var(--btn-gradient-light)' : 'transparent',
                color: activeRole === r ? 'var(--green-dark)' : 'var(--text-secondary)',
                border: activeRole === r ? '2px solid var(--btn-light-border)' : '2px solid transparent',
                boxShadow: activeRole === r ? '0 2px 8px rgba(15, 45, 26, 0.12)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Right: Quick actions with lighter gradient button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onReset}
            style={{
              background: 'var(--btn-gradient-light)',
              color: 'var(--green-dark)',
              border: '2px solid var(--border)',
              padding: '7px 16px',
              borderRadius: 50,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
            }}
          >
            &#8635; Reset Demo
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Sub-tabs for Admin role */}
      {activeRole === 'Admin' && (
        <div style={{
          display: 'flex',
          gap: 24,
          padding: '0 28px',
          borderTop: '2px solid var(--border)',
          background: 'rgba(255, 255, 255, 0.7)',
        }}>
          {subTabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '12px 4px',
                background: 'transparent',
                border: 'none',
                borderBottom: `3px solid ${activeTab === t ? 'var(--green-accent)' : 'transparent'}`,
                color: activeTab === t ? 'var(--green-dark)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
