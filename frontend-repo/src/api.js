const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchState() {
  const res = await fetch(`${API_BASE}/api/state`);
  if (!res.ok) throw new Error('Failed to fetch state');
  return res.json();
}

export async function runPosAudit() {
  const res = await fetch(`${API_BASE}/api/agent/run-pos-audit`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run audit');
  return res.json();
}

export async function resetDemo() {
  const res = await fetch(`${API_BASE}/api/reset-demo`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo');
  return res.json();
}

export async function resolveHITL(logId, decision) {
  const res = await fetch(`${API_BASE}/api/agent/hitl/${logId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) throw new Error('Failed to resolve HITL item');
  return res.json();
}

export async function rollbackBatch(batchId) {
  const res = await fetch(`${API_BASE}/api/agent/rollback/${batchId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rollback');
  return res.json();
}

export async function claimDeal(dealId) {
  const res = await fetch(`${API_BASE}/api/community/claim/${dealId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to claim deal');
  return res.json();
}

export async function submitWhatsAppIngest({ merchantName, merchantType, rawText, audioFile, imageFile }) {
  const formData = new FormData();
  formData.append('merchant_name', merchantName || 'OvenFresh Bakery');
  formData.append('merchant_type', merchantType || 'BAKERY');
  formData.append('location', 'Sector 15, Panvel');
  formData.append('raw_text', rawText || '');
  if (audioFile) formData.append('audio_file', audioFile);
  if (imageFile) formData.append('image_file', imageFile);

  const res = await fetch(`${API_BASE}/api/agent/whatsapp-ingest`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to ingest message');
  return res.json();
}

export async function simulateChillerFault(batchId = 'BATCH-101') {
  const res = await fetch(`${API_BASE}/api/pos/batches/${batchId}/temp-spike`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to simulate temp spike');
  return res.json();
}
