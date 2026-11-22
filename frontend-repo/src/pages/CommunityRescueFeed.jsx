import React, { useState, useEffect } from 'react';
import { fetchState, claimDeal } from '../api';

export default function CommunityRescueFeed() {
  const [liveState, setLiveState] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchState();
      setLiveState(data);
    } catch (err) {
      console.warn('Error fetching deals:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (deal) => {
    setClaimingId(deal._id);
    try {
      await claimDeal(deal._id);
      await loadData();
    } catch (err) {
      alert('Claim failed: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const kpis = liveState?.kpis || { time_saved_mins: 85, revenue_recovered_inr: 0, meals_rescued: 0, co2_prevented_kg: 0 };
  const deals = liveState?.community_deals || [];
  const paidListings = deals.filter((d) => !d.ngo_free_eligible);
  const ngoListings = deals.filter((d) => d.ngo_free_eligible);

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Stats strip with subtle green gradient */}
      <div style={{
        background: 'var(--green-gradient-hero)',
        borderRadius: 16,
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 24,
        marginBottom: 32,
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
      }}>
        {[
          { label: 'Manual Minutes Saved', value: `${kpis.time_saved_mins} mins` },
          { label: 'Merchant Cash Recovered', value: `₹${kpis.revenue_recovered_inr.toFixed(2)}` },
          { label: 'Meals Rescued', value: kpis.meals_rescued },
          { label: 'CO₂e Diverted', value: `${kpis.co2_prevented_kg} kg` },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
        Panvel / Hyperlocal Live Network
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Community & NGO Rescue App
        </h1>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Live Dynamic Clearance Deals & free NGO rescue claims.
        </span>
      </div>

      {/* Grid of all items */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {/* Paid listings */}
        {paidListings.map((item) => {
          const isOutOfStock = item.quantity_remaining <= 0;
          return (
            <div
              key={item._id}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: '20px',
                border: '1px solid #f0f0eb',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  📍 {item.merchant_name} &bull; {item.location}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{item.item_summary}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  {item.original_price && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      ₹{item.original_price}
                    </span>
                  )}
                  <span style={{ fontSize: 20, fontWeight: 800 }}>
                    ₹{item.clearance_price} ({item.discount_pct}% OFF)
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {item.quantity_remaining} {item.unit} left
                </span>
                <button
                  disabled={isOutOfStock || claimingId === item._id}
                  onClick={() => handleClaim(item)}
                  style={{
                    background: isOutOfStock ? '#ccc' : 'var(--green-dark)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 50,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {isOutOfStock ? 'Sold Out' : `Claim Deal (${item.discount_pct}% Off)`}
                </button>
              </div>
            </div>
          );
        })}

        {/* NGO listings */}
        {ngoListings.map((item) => {
          const isOutOfStock = item.quantity_remaining <= 0;
          return (
            <div
              key={item._id}
              style={{
                background: '#f8fafc',
                borderRadius: 14,
                padding: '20px',
                border: '1px solid #bfdbfe',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>
                  FREE NGO RESCUE
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  📍 {item.merchant_name} &bull; {item.location}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{item.item_summary}</div>
                {item.manifest_pdf_url && (
                  <div style={{ marginBottom: 12 }}>
                    <a
                      href={`http://localhost:8000${item.manifest_pdf_url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                    >
                      📄 View FSSAI Manifest Certificate
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {item.quantity_remaining} {item.unit} available
                </span>
                <button
                  disabled={isOutOfStock || claimingId === item._id}
                  onClick={() => handleClaim(item)}
                  style={{
                    background: isOutOfStock ? '#ccc' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 50,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isOutOfStock ? 'Claimed' : 'Claim NGO Pickup'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
