import React, { useState, useEffect } from 'react';
import { fetchState, runPosAudit, simulateChillerFault, submitWhatsAppIngest, resetDemo } from '../api';

export default function ShopOwnerView() {
  const [liveState, setLiveState] = useState(null);
  const [surplusText, setSurplusText] = useState('');
  const [merchantType, setMerchantType] = useState('SUPERMARKET');
  const [posting, setPosting] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [spiking, setSpiking] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchState();
      setLiveState(data);
    } catch (err) {
      console.warn('Error fetching POS state:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePost = async () => {
    if (!surplusText.trim()) return;
    setPosting(true);
    try {
      await submitWhatsAppIngest({
        merchantName: 'FreshMart Supermarket - Panvel',
        merchantType,
        rawText: surplusText,
      });
      setSurplusText('');
      await loadData();
      alert('Surplus posted & validated by safety rails!');
    } catch (e) {
      alert('Post failed: ' + e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleAudit = async () => {
    setRunningAudit(true);
    try {
      await runPosAudit();
      await loadData();
    } catch (e) {
      alert('Audit failed: ' + e.message);
    } finally {
      setRunningAudit(false);
    }
  };

  const handleChillerSpike = async (batchId = 'BATCH-101') => {
    setSpiking(true);
    try {
      await simulateChillerFault(batchId);
      await loadData();
      alert(`Chiller fault simulated on ${batchId}! Recorded temp jumped to 9.5°C.`);
    } catch (e) {
      alert('Fault simulation failed: ' + e.message);
    } finally {
      setSpiking(false);
    }
  };

  const batches = liveState?.inventory_batches || [];

  return (
    <div style={{ padding: '32px', maxWidth: 1150, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Laptop 2 &bull; Supermarket Inventory &amp; POS Station
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            FreshMart Supermarket POS Terminal
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Real-time live inventory feed, IoT chiller monitor, and audit triggers synced over local LAN with Laptop 1.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={async () => { await resetDemo(); await loadData(); }}
            style={{
              background: '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset POS Data
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
        {/* Left: Live Inventory Batches (Laptop 2 POS core) */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '28px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #f0f0eb',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Active Supermarket Batches</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>Live 2-way sync with Laptop 1</span>
              </div>
            </div>
            <button
              onClick={handleAudit}
              disabled={runningAudit}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {runningAudit ? 'Auditing...' : 'Trigger 7:00 PM Audit'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {batches.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888' }}>Loading inventory batches...</p>
            ) : (
              batches.map((b) => {
                const isTempBreach = b.max_recorded_temp_c > b.safe_temp_limit_c;
                const isRerouted = b.status === 'BIOGAS_COMPOST';
                const isDonated = b.status === 'DONATED';
                const isMarkedDown = b.status === 'MARKED_DOWN';
                const isHitl = b.status === 'PAUSED_HITL';

                let statusBadgeColor = '#22c55e';
                let statusBg = '#dcfce7';
                if (isRerouted || isTempBreach) { statusBadgeColor = '#ef4444'; statusBg = '#fee2e2'; }
                else if (isHitl) { statusBadgeColor = '#f59e0b'; statusBg = '#fef3c7'; }
                else if (isDonated) { statusBadgeColor = '#3b82f6'; statusBg = '#dbeafe'; }

                return (
                  <div
                    key={b.batch_id}
                    style={{
                      borderRadius: 12,
                      padding: '14px 16px',
                      background: isTempBreach ? '#fff5f5' : '#f8fafc',
                      border: `1.5px solid ${isTempBreach ? '#fca5a5' : '#e2e8f0'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{b.sku_name}</span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: statusBg,
                          color: statusBadgeColor,
                        }}>
                          {b.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Batch: <b>{b.batch_id}</b> &bull; Stock: <b>{b.quantity} {b.unit}</b> &bull; Expiry: <b>{b.hours_to_expiry}h left</b>
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Recorded Temp: <b style={{ color: isTempBreach ? '#ef4444' : '#10b981' }}>{b.max_recorded_temp_c}°C</b> (Safe Limit: &le; {b.safe_temp_limit_c}°C)
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: isMarkedDown ? '#16a34a' : '#0f172a' }}>
                        ₹{b.current_price}
                        {b.retail_price !== b.current_price && (
                          <span style={{ fontSize: 12, textDecoration: 'line-through', color: '#94a3b8', marginLeft: 6 }}>
                            ₹{b.retail_price}
                          </span>
                        )}
                      </div>
                      {b.batch_id === 'BATCH-101' && (
                        <button
                          onClick={() => handleChillerSpike('BATCH-101')}
                          disabled={spiking}
                          style={{
                            marginTop: 6,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #f87171',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Simulate Chiller Fault
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Quick Ingest / Store Operator Studio */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '28px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #f0f0eb',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Store Operator Quick-Drop</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Quick-add surplus items from the checkout counter into the central rescue network.
            </p>

            {/* Quick Demo Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setSurplusText('Bakery Counter: 15 artisanal sourdough loaves and 20 masala puffs at 50% discount.')}
                style={{
                  padding: '8px 12px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                🥖 <b>Bakery Surplus:</b> 15 sourdough loaves & 20 puffs (50% off)
              </button>
              <button
                onClick={() => setSurplusText('Chilled Dairy: Leftover paneer butter gravy tray unchilled for 5 hours — donate to NGO.')}
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                ⚠️ <b>FSSAI Trap:</b> 5-hr unchilled buffet gravy
              </button>
            </div>

            <textarea
              value={surplusText}
              onChange={(e) => setSurplusText(e.target.value)}
              placeholder="Enter item name, quantity, price, or cold chain status..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                border: '1.5px solid #cbd5e1',
                borderRadius: 10,
                fontSize: 13,
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            <button
              onClick={handlePost}
              disabled={posting}
              style={{
                width: '100%',
                background: 'var(--green-dark)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {posting ? 'Validating via Safety Rails...' : 'Post Surplus to ZeroSpoil Engine'}
            </button>
          </div>

          <div style={{
            background: '#ecfdf5',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 12,
            color: '#047857',
            marginTop: 20,
          }}>
            🛡️ <b>Automated Safety Guard:</b> Any item breaching cold-chain or FSSAI 2-hr rules is automatically blocked from retail.
          </div>
        </div>
      </div>
    </div>
  );
}
