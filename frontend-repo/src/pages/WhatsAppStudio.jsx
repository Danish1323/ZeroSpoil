import React, { useState } from 'react';
import { whatsappPresets } from '../data/mockData';
import { submitWhatsAppIngest } from '../api';

export default function WhatsAppStudio() {
  const [vendorMessage, setVendorMessage] = useState('');
  const [merchantName, setMerchantName] = useState('OvenFresh Bakery');
  const [merchantType, setMerchantType] = useState('BAKERY');
  const [extractionResult, setExtractionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  const handleSend = async () => {
    if (!vendorMessage.trim()) return;
    setLoading(true);
    try {
      const res = await submitWhatsAppIngest({
        merchantName,
        merchantType,
        rawText: vendorMessage,
      });
      setExtractionResult(res);
    } catch (err) {
      alert('Ingestion error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset) => {
    setActivePreset(preset.title);
    setVendorMessage(preset.desc);
    setExtractionResult(null);
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Multimodal Live AI Ingestion
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Local Bakery, Restaurant & Vendor WhatsApp Studio
          </h1>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'flex-end' }}>
          Real speech & vision analysis powered by Whisper & OpenRouter.
        </span>
      </div>

      {/* Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {whatsappPresets.map((p) => (
          <div
            key={p.title}
            onClick={() => handlePreset(p)}
            style={{
              background: activePreset === p.title ? '#eef2ff' : '#fff',
              border: `1.5px solid ${activePreset === p.title ? 'var(--blue)' : '#f0f0eb'}`,
              borderRadius: 12,
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              {p.vendor}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              "{p.desc}"
            </div>
          </div>
        ))}
      </div>

      {/* Simulator input */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #f0f0eb', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="Merchant Name"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
          />
          <select
            value={merchantType}
            onChange={(e) => setMerchantType(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
          >
            <option value="BAKERY">BAKERY</option>
            <option value="RESTAURANT">RESTAURANT</option>
            <option value="VENDOR">VENDOR</option>
            <option value="SUPERMARKET">SUPERMARKET</option>
          </select>
        </div>

        <textarea
          value={vendorMessage}
          onChange={(e) => setVendorMessage(e.target.value)}
          placeholder="Type or paste WhatsApp message (Hindi/English)..."
          rows={4}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSend}
            disabled={loading}
            style={{
              background: 'var(--green-dark)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'AI Analyzing Safety & Margins...' : '✈ Ingest WhatsApp Message'}
          </button>
        </div>
      </div>

      {/* Result feedback */}
      {extractionResult && (
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: '24px', border: '1px solid #cbd5e1' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>AI Extraction & Safety Result</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {extractionResult.items_processed?.map((item) => (
              <div key={item._id} style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{item.item_name}</span>
                  <span style={{
                    fontWeight: 700,
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: item.safety_verdict.includes('APPROVED') ? '#dcfce7' : '#fee2e2',
                    color: item.safety_verdict.includes('APPROVED') ? '#15803d' : '#b91c1c',
                  }}>
                    {item.safety_verdict}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
