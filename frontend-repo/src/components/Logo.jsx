import React from 'react';

export default function Logo({ size = 28, withText = true, dark = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Redesigned Sprout Badge with subtle green-tinted drop shadow */}
      <div style={{
        width: size,
        height: size,
        background: dark ? '#ffffff' : 'linear-gradient(145deg, #164225 0%, #0f2d1a 100%)',
        borderRadius: size * 0.28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(15, 45, 26, 0.25)',
        border: '1.5px solid rgba(200, 207, 196, 0.4)',
        flexShrink: 0,
      }}>
        {/* Two leaves (bright green #4ade80 left, soft green #86efac right) emerging from one bold central stem */}
        <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none">
          {/* Bold Central Stem */}
          <path
            d="M12 21V11C12 8 13.5 5 17 4"
            stroke={dark ? '#0f2d1a' : '#86efac'}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Left Leaf: Bright Green #4ade80 */}
          <path
            d="M12 14C8 14 5 11 6 6C11 6 12 10 12 14Z"
            fill="#4ade80"
          />
          {/* Right Leaf: Soft Green #86efac */}
          <path
            d="M12 11C15.5 11 19 8.5 18 3.5C13.5 3.5 12 7.5 12 11Z"
            fill="#86efac"
          />
        </svg>
      </div>

      {withText && (
        <span style={{
          fontWeight: 800,
          fontSize: size * 0.78,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          <span style={{ color: dark ? '#ffffff' : '#0d0d0d' }}>Zero</span>
          <span style={{ color: 'var(--green-accent)' }}>Spoil</span>
        </span>
      )}
    </div>
  );
}
