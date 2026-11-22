let state = {};
let seenAlertIds = new Set();
let userCurrentDistanceKm = 1.2; // Default: user/NGO is 1.2 km away (Nearby)

// Store Reference Anchor: FreshMart Supermarket - Panvel (Sector 19)
const STORE_LAT = 18.9902;
const STORE_LON = 73.1168;

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

function requestLiveGPS() {
  const gpsBtn = document.getElementById('gps-btn');
  const coordsTag = document.getElementById('live-coords-tag');
  const selector = document.getElementById('user-location-selector');

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  gpsBtn.innerText = "📡 Locating...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const dist = calculateHaversineDistanceKm(STORE_LAT, STORE_LON, lat, lon);

      userCurrentDistanceKm = dist;
      gpsBtn.innerText = "📡 GPS Active";
      gpsBtn.style.background = "rgba(16, 185, 129, 0.4)";
      
      coordsTag.style.display = "inline-block";
      coordsTag.innerText = `${lat.toFixed(4)}, ${lon.toFixed(4)} (${dist} km)`;

      // Add live option to selector
      const opt = document.createElement('option');
      opt.value = dist;
      opt.innerText = `🛰️ Real GPS (${dist} km away)`;
      opt.selected = true;
      selector.insertBefore(opt, selector.firstChild);

      const isNearby = dist <= 3.0;
      showToast(
        "Live GPS Locked",
        `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} &bull; Distance from Store: <b>${dist} km</b>.<br>${isNearby ? '✅ You are within the 3.0 km rescue perimeter!' : '⚠️ Outside 3.0 km perimeter — far-away alerts filtered out.'}`,
        isNearby ? 'success' : 'warning'
      );
    },
    (error) => {
      gpsBtn.innerText = "📡 Use Live GPS";
      showToast("GPS Notice", "Permission denied or unavailable. You can use the preset locations dropdown instead.", "warning");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function updateUserDistance(val) {
  userCurrentDistanceKm = parseFloat(val);
  const isNearby = userCurrentDistanceKm <= 3.0;
  showToast(
    "Location Updated", 
    `You are now set to ${userCurrentDistanceKm} km away. ${isNearby ? '✅ You WILL receive nearby rescue & deal alerts (< 3.0 km).' : '🚫 Far away! Nearby alerts will be filtered out.'}`,
    isNearby ? 'info' : 'warning'
  );
}

function showToast(title, message, severity = 'warning', distanceKm = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${severity}`;
  toast.innerHTML = `
    <div style="font-size: 20px;">${severity === 'danger' ? '&#9888;&#65039;' : (severity === 'success' ? '&#9989;' : '&#128276;')}</div>
    <div style="flex: 1;">
      <div class="toast-title">${title} ${distanceKm ? `<span style="font-size: 10px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${distanceKm} km away</span>` : ''}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 7000);
}

function processSystemAlerts(alerts) {
  if (!alerts || !Array.isArray(alerts)) return;
  alerts.forEach(alert => {
    if (!seenAlertIds.has(alert._id)) {
      seenAlertIds.add(alert._id);

      // Geo-Fencing Filter: Only show notification to nearby customers & NGOs!
      const maxRadius = alert.max_radius_km || 3.0;
      if (userCurrentDistanceKm > maxRadius) {
        console.log(`[Geo-Fence Blocked] Alert '${alert.title}' suppressed because user distance (${userCurrentDistanceKm} km) > max radius (${maxRadius} km)`);
        return;
      }

      showToast(alert.title, alert.message, alert.severity || 'warning', alert.distance_km);
    }
  });
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    state = await res.json();
    renderUI();
  } catch (err) {
    console.warn("Polling connection error:", err);
  }
}

function renderUI() {
  // Update KPIs
  if (state.kpis) {
    document.getElementById('kpi-time').innerText = `${state.kpis.time_saved_mins} m`;
    document.getElementById('kpi-cash').innerText = `₹${state.kpis.revenue_recovered_inr.toFixed(2)}`;
    document.getElementById('kpi-meals').innerText = state.kpis.meals_rescued;
    document.getElementById('kpi-co2').innerText = `${state.kpis.co2_prevented_kg} kg`;
  }

  // Check and display any new system alerts broadcasted by n8n
  processSystemAlerts(state.system_alerts);

  // Update HITL & Safety Rails Panel
  renderHITLAndInterceptions();
  renderAuditLogs();
  renderDeals();
}

function renderHITLAndInterceptions() {
  const container = document.getElementById('hitl-list');
  const countBadge = document.getElementById('hitl-count');
  
  // Deduplicate by batch_id so multiple historic audit logs don't spawn duplicate cards
  const pausedMap = new Map();
  (state.agent_audit_logs || []).forEach(l => {
    if (l.safety_verdict === 'PAUSED_HITL' && !pausedMap.has(l.batch_id)) {
      // Check if batch is still in PAUSED_HITL state in inventory_batches
      const batch = (state.inventory_batches || []).find(b => b.batch_id === l.batch_id);
      if (!batch || batch.status === 'PAUSED_HITL' || batch.status === 'ACTIVE') {
        pausedMap.set(l.batch_id, l);
      }
    }
  });
  const pausedLogs = Array.from(pausedMap.values());

  const blockedMap = new Map();
  (state.agent_audit_logs || []).forEach(l => {
    if (l.safety_verdict === 'BLOCKED_REROUTED' && !blockedMap.has(l.batch_id)) {
      blockedMap.set(l.batch_id, l);
    }
  });
  const blockedLogs = Array.from(blockedMap.values());

  countBadge.innerText = `${pausedLogs.length} Pending`;

  if (pausedLogs.length === 0 && blockedLogs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No safety alerts or approval requests active.</p>';
    return;
  }

  let html = '';

  // Render Paused HITL cards (Amber)
  pausedLogs.forEach(log => {
    html += `
      <div class="card-item amber-border">
        <div class="item-header">
          <span>${log.item_name || log.batch_id}</span>
          <span class="verdict-tag tag-paused">PAUSED HITL</span>
        </div>
        <div class="item-detail">
          <strong>Trigger:</strong> ${log.rail_triggered}<br>
          ${log.explanation}
        </div>
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button class="btn btn-primary" style="font-size: 11px; padding: 5px 10px;" onclick="resolveHITL('${log._id}', 'APPROVE')">Approve (60% Off)</button>
          <button class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px;" onclick="resolveHITL('${log._id}', 'CLAMP_COST')">Clamp to Wholesale Cost</button>
          <button class="btn btn-danger" style="font-size: 11px; padding: 5px 10px;" onclick="resolveHITL('${log._id}', 'REJECT')">Reject</button>
        </div>
      </div>
    `;
  });

  // Render Blocked Safety Interceptions (Red)
  blockedLogs.slice(0, 5).forEach(log => {
    html += `
      <div class="card-item danger-border">
        <div class="item-header">
          <span>${log.item_name || log.batch_id}</span>
          <span class="verdict-tag tag-blocked">BLOCKED &bull; REROUTED</span>
        </div>
        <div class="item-detail">
          <strong>Rail:</strong> ${log.rail_triggered}<br>
          ${log.explanation}
        </div>
        <div style="font-size: 11px; color: #f87171; font-weight: 600;">
          &#10006; Human consumption blocked. Automatically rerouted to GreenCycle Biogas &amp; Gaushala.
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderAuditLogs() {
  const container = document.getElementById('audit-trace-list');
  const logs = state.agent_audit_logs || [];

  if (logs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No actions logged yet. Click "Run POS Audit Now" above.</p>';
    return;
  }

  let html = '';
  logs.forEach(log => {
    const isApproved = log.safety_verdict.includes('APPROVED');
    const isBlocked = log.safety_verdict === 'BLOCKED_REROUTED';
    const tagClass = isApproved ? 'tag-approved' : (isBlocked ? 'tag-blocked' : 'tag-paused');

    html += `
      <div class="card-item ${isApproved ? 'green-border' : (isBlocked ? 'danger-border' : 'amber-border')}">
        <div class="item-header">
          <span>${log.item_name || log.batch_id}</span>
          <span class="verdict-tag ${tagClass}">${log.safety_verdict}</span>
        </div>
        <div class="item-detail">
          <strong>Batch ID:</strong> ${log.batch_id} &bull; <strong>Action:</strong> ${log.final_tool || log.proposed_tool}<br>
          <span style="color: var(--text-muted);">${log.explanation}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <div>
            ${log.manifest_pdf_url ? `<a href="${log.manifest_pdf_url}" target="_blank" style="color: #60a5fa; font-size: 12px; font-weight: 600; text-decoration: none;">&#128196; View FSSAI Manifest PDF</a>` : ''}
          </div>
          <div>
            <button class="btn btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="rollbackBatch('${log.batch_id}')">&#8630; Rollback</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderDeals() {
  const container = document.getElementById('deals-container');
  const deals = state.community_deals || [];

  if (deals.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No active deals published yet.</p>';
    return;
  }

  let html = '';
  deals.forEach(deal => {
    const isNGO = deal.ngo_free_eligible;
    html += `
      <div class="deal-card">
        <div>
          <span class="deal-card-badge" style="background: ${isNGO ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${isNGO ? '#60a5fa' : '#34d399'};">
            ${isNGO ? 'FREE NGO RESCUE' : `${deal.discount_pct}% OFF CLEARANCE`}
          </span>
          <h4 style="font-size: 15px; margin-bottom: 6px;">${deal.item_summary}</h4>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            &#128205; ${deal.merchant_name} &bull; ${deal.location}
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <div>
              <span class="deal-discount">${isNGO ? 'FREE' : `₹${deal.clearance_price}`}</span>
              ${!isNGO && deal.original_price ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 13px; margin-left: 6px;">₹${deal.original_price}</span>` : ''}
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">${deal.quantity_remaining} ${deal.unit} left</span>
          </div>
          <button class="btn ${isNGO ? 'btn-primary' : 'btn-success'}" style="width: 100%; justify-content: center;" onclick="claimDeal('${deal._id}')">
            ${isNGO ? 'Claim NGO Pickup' : `Claim Deal (${deal.discount_pct}% Off)`}
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

let mediaRecorder = null;
let recordedAudioChunks = [];
let recordedAudioBlob = null;
let selectedImageFile = null;

async function toggleAudioRecording() {
  const btn = document.getElementById('record-btn');
  const status = document.getElementById('record-status');

  if (mediaRecorder && mediaRecorder.state === "recording") {
    // Stop Recording
    mediaRecorder.stop();
    btn.innerHTML = "&#127908; Record Voice Note";
    btn.style.background = "rgba(239, 68, 68, 0.2)";
    status.innerText = "Processing voice note...";
    return;
  }

  // Start Recording
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedAudioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedAudioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedAudioBlob = new Blob(recordedAudioChunks, { type: 'audio/webm' });
      status.innerHTML = `<span style="color: #34d399;">&#10004; Voice note recorded (${(recordedAudioBlob.size / 1024).toFixed(1)} KB)</span>`;
      btn.innerHTML = "&#8635; Re-record Voice";
      btn.style.background = "rgba(59, 130, 246, 0.2)";
      btn.style.color = "#60a5fa";

      // Auto-populate hint if text is empty
      const textInput = document.getElementById('wa-text');
      if (!textInput.value) {
        textInput.value = "[Audio Voice Note Attached] Analyzing spoken surplus items...";
      }
    };

    mediaRecorder.start();
    btn.innerHTML = "&#9209; Stop Recording";
    btn.style.background = "#ef4444";
    btn.style.color = "#ffffff";
    status.innerHTML = `<span style="color: #ef4444; font-weight: 600;">&#9679; Recording live audio... Speak now!</span>`;
  } catch (err) {
    alert("Microphone access denied or unavailable: " + err);
  }
}

function previewSelectedImage(input) {
  if (input.files && input.files[0]) {
    selectedImageFile = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('image-preview').src = e.target.result;
      document.getElementById('image-preview-container').style.display = 'block';
      const badge = document.getElementById('image-name-badge');
      badge.style.display = 'inline-block';
      badge.innerText = selectedImageFile.name;
    };
    reader.readAsDataURL(selectedImageFile);
  }
}

function clearSelectedImage() {
  selectedImageFile = null;
  document.getElementById('wa-image').value = '';
  document.getElementById('image-preview-container').style.display = 'none';
  document.getElementById('image-name-badge').style.display = 'none';
}

function applyPreset(index) {
  const merchant = document.getElementById('wa-merchant');
  const type = document.getElementById('wa-type');
  const text = document.getElementById('wa-text');

  if (index === 1) {
    merchant.value = "OvenFresh Bakery";
    type.value = "BAKERY";
    text.value = "Bhai OvenFresh Bakery se bol raha hoon, aaj ke 15 sourdough bread aur 20 masala puffs bache hain, 50% off pe community mein daal do.";
  } else if (index === 2) {
    merchant.value = "Raju Fruit Stall";
    type.value = "VENDOR";
    text.value = "Raju Fruit Stall Sector 11: 12 kg ripe Alphonso mangoes & bananas at ₹60/kg clearance before 10 PM.";
  } else if (index === 3) {
    merchant.value = "SpiceRoute Kitchen";
    type.value = "RESTAURANT";
    text.value = "SpiceRoute Kitchen: Leftover paneer gravy buffet tray sitting unchilled since 4 PM (5 hours) — donate to NGO.";
  }
}

async function submitWhatsApp(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('wa-submit-btn');
  submitBtn.innerText = "⏳ Ingesting AI...";
  submitBtn.disabled = true;

  const formData = new FormData();
  formData.append('merchant_name', document.getElementById('wa-merchant').value);
  formData.append('merchant_type', document.getElementById('wa-type').value);
  formData.append('raw_text', document.getElementById('wa-text').value);

  // Attach recorded audio if present
  if (recordedAudioBlob) {
    formData.append('audio_file', recordedAudioBlob, 'whatsapp_voice_note.webm');
  }

  // Attach selected image if present
  if (selectedImageFile) {
    formData.append('image_file', selectedImageFile);
  }

  try {
    const res = await fetch('/api/agent/whatsapp-ingest', { method: 'POST', body: formData });
    const data = await res.json();
    
    // Clear inputs & show toast
    recordedAudioBlob = null;
    clearSelectedImage();
    document.getElementById('record-status').innerText = "Click to speak (Hindi/English)";
    document.getElementById('record-btn').innerHTML = "&#127908; Record Voice Note";
    document.getElementById('wa-text').value = '';

    showToast(
      "WhatsApp Ingest Complete", 
      `Processed ${data.items_processed.length} surplus item(s) with deterministic food safety checks.`,
      "success"
    );

    // Switch to Tab 1 to see the safety trace
    switchTab('tab-rails', document.querySelectorAll('.tab-btn')[0]);
    fetchState();
  } catch (err) {
    alert("Error ingesting message: " + err);
  } finally {
    submitBtn.innerText = "✈ Send via WhatsApp";
    submitBtn.disabled = false;
  }
}

async function triggerPosAudit() {
  try {
    const res = await fetch('/api/agent/run-pos-audit', { method: 'POST' });
    const data = await res.json();
    fetchState();
  } catch (err) {
    alert("Failed to run audit: " + err);
  }
}

async function resolveHITL(logId, decision) {
  try {
    await fetch(`/api/agent/hitl/${logId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    fetchState();
  } catch (err) {
    alert("Failed to resolve: " + err);
  }
}

async function rollbackBatch(batchId) {
  try {
    await fetch(`/api/agent/rollback/${batchId}`, { method: 'POST' });
    fetchState();
  } catch (err) {
    alert("Rollback failed: " + err);
  }
}

async function claimDeal(dealId) {
  try {
    await fetch(`/api/community/claim/${dealId}`, { method: 'POST' });
    fetchState();
  } catch (err) {
    alert("Claim failed: " + err);
  }
}

async function resetDemo() {
  if (confirm("Reset demo data back to initial state?")) {
    await fetch('/api/reset-demo', { method: 'POST' });
    fetchState();
  }
}

// Initial fetch & 2-second polling loop
fetchState();
setInterval(fetchState, 2000);
