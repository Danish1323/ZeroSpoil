import React, { useState, useEffect } from 'react';
import { fetchState, runPosAudit, resetDemo, resolveHITL, rollbackBatch } from '../api';

function StatusBadge({ status }) {
  const colors = {
    EXECUTED: { bg: '#e8f5e9', color: '#2e7d32' },
    APPROVED: { bg: '#e8f5e9', color: '#2e7d32' },
    PAUSED_HITL: { bg: '#fff3e0', color: '#e65100' },
    BLOCKED_REROUTED: { bg: '#fce4ec', color: '#c62828' },
    ROLLED_BACK: { bg: '#ede7f6', color: '#512da8' },
  };
  const c = colors[status] || { bg: '#f5f5f5', color: '#666' };
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 6,
      letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  );
}

export default function AdminAgentView({ onReset }) {
  const [liveState, setLiveState] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchState();
      setLiveState(data);
    } catch (err) {
      console.warn('Error fetching live state:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRunAudit = async () => {
    setLoadingAudit(true);
    try {
      await runPosAudit();
      await loadData();
    } catch (e) {
      alert('Audit failed: ' + e.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleGlobalReset = async () => {
    try {
      await resetDemo();
      await loadData();
      if (onReset) onReset();
    } catch (e) {
      alert('Reset failed: ' + e.message);
    }
  };

  const handleResolve = async (logId, decision) => {
    try {
      await resolveHITL(logId, decision);
      await loadData();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const handleRollback = async (batchId) => {
    try {
      await rollbackBatch(batchId);
      await loadData();
    } catch (e) {
      alert('Rollback failed: ' + e.message);
    }
  };

  const kpis = liveState?.kpis || { time_saved_mins: 85, revenue_recovered_inr: 0, meals_rescued: 0, co2_prevented_kg: 0 };
  const auditLogs = liveState?.agent_audit_logs || [];
  const hitlItems = auditLogs.filter(l => l.safety_verdict === 'PAUSED_HITL');
  const safetyBlocks = auditLogs.filter(l => l.safety_verdict === 'BLOCKED_REROUTED');

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
        Autonomous Command Center &bull; Connected to Live Engine
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>Network overview</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleRunAudit}
            disabled={loadingAudit}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loadingAudit ? 'Auditing...' : '▶ Run POS Audit Now'}
          </button>
          <button
            onClick={handleGlobalReset}
            style={{
              background: 'var(--green-dark)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* Stats strip with elegant green gradient */}
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
          { label: 'Time Saved', value: `${kpis.time_saved_mins} mins` },
          { label: 'Cash Recovered ₹', value: `₹${kpis.revenue_recovered_inr.toFixed(2)}` },
          { label: 'Meals Rescued', value: kpis.meals_rescued },
          { label: 'CO₂e Diverted kg', value: `${kpis.co2_prevented_kg} kg` },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Safety Rail Blocks */}
          <div style={{
            background: '#fff',
            borderRadius: 14,
            padding: '22px',
            border: '1px solid #f0f0eb',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Safety Rail Blocks ({safetyBlocks.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {safetyBlocks.length === 0 ? (
                <p style={{ fontSize: 13, color: '#888' }}>No safety breaches active.</p>
              ) : (
                safetyBlocks.map((b) => (
                  <div key={b._id} style={{
                    borderRadius: 10,
                    padding: '14px',
                    background: '#fff8f8',
                    border: '1px solid #ffcdd2',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#c62828' }}>{b.rail_triggered}</span>
                      <StatusBadge status="BLOCKED_REROUTED" />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{b.item_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.explanation}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* HITL Queue */}
          <div style={{
            background: '#fff',
            borderRadius: 14,
            padding: '22px',
            border: '1px solid #f0f0eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Human-in-the-Loop Queue</h2>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>{hitlItems.length} PENDING</span>
            </div>
            {hitlItems.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888' }}>No items pending approval.</p>
            ) : (
              hitlItems.map((h) => (
                <div key={h._id} style={{
                  background: '#fffbf0',
                  border: '1px solid #ffe082',
                  borderRadius: 10,
                  padding: '14px',
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{h.item_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{h.explanation}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleResolve(h._id, 'APPROVE')}
                      style={{
                        background: 'var(--green-dark)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Approve Discount
                    </button>
                    <button
                      onClick={() => handleResolve(h._id, 'CLAMP_COST')}
                      style={{
                        background: '#334155',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clamp to Wholesale Cost
                    </button>
                    <button
                      onClick={() => handleResolve(h._id, 'REJECT')}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right col: Real audit logs */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '22px',
          border: '1px solid #f0f0eb',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Execution Audit Log & Rollback</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
            {auditLogs.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888' }}>No logs yet. Run the audit.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#f9f9f7',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{log.item_name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {log.batch_id} &bull; {log.final_tool || log.proposed_tool}
                    </div>
                    {log.manifest_pdf_url && (
                      <a
                        href={`http://localhost:8000${log.manifest_pdf_url}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                      >
                        📄 View FSSAI Manifest PDF
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={log.safety_verdict} />
                    <button
                      onClick={() => handleRollback(log.batch_id)}
                      style={{
                        background: '#eee',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Rollback
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
