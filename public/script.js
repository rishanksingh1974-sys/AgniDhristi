// =============================================
// AgniDrishti – Enhanced Frontend Script
// Tech: Vanilla JavaScript + Leaflet.js
// =============================================

// Initialize Leaflet Map centered on Sangrur, Punjab
const map = L.map('map', {
  zoomControl: false
}).setView([30.245, 75.845], 12);

// Place zoom controls top-right
L.control.zoom({ position: 'topright' }).addTo(map);

// Add Satellite Base Map Layer
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri | AgniDrishti (INSAT-3DS + Sentinel-2)'
}).addTo(map);

const eveningLayerGroup = L.layerGroup().addTo(map);
let activeCaseIndex = 0;
let sidebarOpen = true;

// Default Fallback Cases covering all Two-Signal Rules and Limits
let casesData = [
  {
    id: "AD-2026-01",
    village: "Dirba Block, Sangrur",
    coords: [30.255, 75.830],
    zoneBounds: [[30.240, 75.810], [30.270, 75.850]], // ~4 km INSAT-3DS tripwire
    fieldPoly: [[30.253, 75.828], [30.253, 75.833], [30.257, 75.833], [30.257, 75.828]], // 10 m Sentinel-2
    insatSpike: "Heat spike at 17:30 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "Scar detected on 10 m before/after field photo",
    ruleDecision: "Confirmed burning",
    badgeClass: "badge-confirmed",
    polyColor: "#dc2626",
    afterPatchClass: "patch-burnt",
    burntArea: "2.8 Acres",
    confidence: "89% (Heat spike + burn scar agree)",
    confidenceValue: 89,
    status: "Pending Officer Field Check",
    beforeLabel: "Before: Unburnt Field (10 m)",
    afterLabel: "After: Burnt Field Scar (10 m)"
  },
  {
    id: "AD-2026-02",
    village: "Sunam East, Sangrur",
    coords: [30.225, 75.875],
    zoneBounds: [[30.210, 75.855], [30.240, 75.895]],
    fieldPoly: [[30.223, 75.873], [30.223, 75.878], [30.227, 75.878], [30.227, 75.873]],
    insatSpike: "Heat spike at 18:00 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "No scar on 10 m before/after photo",
    ruleDecision: "Likely false alarm: re-check",
    badgeClass: "badge-false",
    polyColor: "#eab308",
    afterPatchClass: "patch-green",
    burntArea: "0.0 Acres",
    confidence: "24% (Mismatch: re-checked, not punished)",
    confidenceValue: 24,
    status: "Marked for Re-check (No Penalty)",
    beforeLabel: "Before: Normal Field (10 m)",
    afterLabel: "After: No Burn Scar Found"
  },
  {
    id: "AD-2026-03",
    village: "Lehra North, Sangrur",
    coords: [30.268, 75.885],
    zoneBounds: null,
    fieldPoly: [[30.266, 75.882], [30.266, 75.887], [30.270, 75.887], [30.270, 75.882]],
    insatSpike: "No spike recorded on ~4 km tripwire",
    sentinelScar: "Scar detected on 10 m before/after photo",
    ruleDecision: "Missed by the tripwire, caught late",
    badgeClass: "badge-late",
    polyColor: "#0ea5e9",
    afterPatchClass: "patch-burnt",
    burntArea: "1.4 Acres",
    confidence: "75% (CEEW burn-scar accuracy benchmark)",
    confidenceValue: 75,
    status: "Pending Officer Field Check",
    beforeLabel: "Before: Harvested Field (10 m)",
    afterLabel: "After: Burnt Field Scar (10 m)"
  },
  {
    id: "AD-2026-04",
    village: "Dhuri South, Sangrur",
    coords: [30.215, 75.815],
    zoneBounds: [[30.200, 75.795], [30.230, 75.835]],
    fieldPoly: [[30.213, 75.812], [30.213, 75.818], [30.217, 75.818], [30.217, 75.812]],
    insatSpike: "Heat spike at 19:00 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "Haze or cloud blocked optical imagery",
    ruleDecision: "Re-check next clear pass",
    badgeClass: "badge-haze",
    polyColor: "#a855f7",
    afterPatchClass: "patch-haze",
    burntArea: "Pending Clear Pass",
    confidence: "Queued (Never silently dropped)",
    confidenceValue: 0,
    status: "Marked 're-check next clear pass'",
    beforeLabel: "Before: Clear Field Photo",
    afterLabel: "After: Blocked by Haze/Cloud"
  }
];

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// =============================================
// STATUS COUNTERS
// =============================================
function updateStatusCounters(mode = 'evening') {
  if (mode === 'midday') {
    document.getElementById('statConfirmed').innerText = "0";
    document.getElementById('statFalseAlarm').innerText = "0";
    document.getElementById('statCaughtLate').innerText = "0";
    document.getElementById('statHaze').innerText = "0";
    return;
  }

  const confirmedCount = casesData.filter(c => c.ruleDecision === "Confirmed burning").length;
  const falseAlarmCount = casesData.filter(c => c.ruleDecision === "Likely false alarm: re-check").length;
  const caughtLateCount = casesData.filter(c => c.ruleDecision === "Missed by the tripwire, caught late").length;
  const hazeCount = casesData.filter(c => c.ruleDecision === "Re-check next clear pass").length;

  document.getElementById('statConfirmed').innerText = String(confirmedCount);
  document.getElementById('statFalseAlarm').innerText = String(falseAlarmCount);
  document.getElementById('statCaughtLate').innerText = String(caughtLateCount);
  document.getElementById('statHaze').innerText = String(hazeCount);
}

// =============================================
// FETCH CASES FROM BACKEND
// =============================================
async function loadCases() {
  try {
    const res = await fetch('/api/cases');
    if (res.ok) {
      const data = await res.json();
      // Ensure confidenceValue exists for each case
      casesData = data.map(c => ({
        ...c,
        confidenceValue: c.confidenceValue || parseConfidenceValue(c.confidence)
      }));
    }
  } catch (err) {
    // Runs seamlessly with local casesData if opened directly as index.html
  }
  updateStatusCounters('evening');
  renderMapLayers();
  renderEvidencePack(0);
}

// Extract numeric confidence from string like "89% (Heat spike + burn scar agree)"
function parseConfidenceValue(str) {
  if (!str) return 0;
  const match = str.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : 0;
}

// =============================================
// MAP RENDERING
// =============================================
function renderMapLayers() {
  eveningLayerGroup.clearLayers();

  casesData.forEach((item, index) => {
    // Safe check so an empty array [] from MongoDB never crashes Leaflet
    if (Array.isArray(item.zoneBounds) && item.zoneBounds.length === 2) {
      const rect = L.rectangle(item.zoneBounds, {
        color: "#f97316",
        weight: 2,
        dashArray: "6, 6",
        fillColor: "#f97316",
        fillOpacity: 0.15
      }).addTo(eveningLayerGroup);

      rect.bindTooltip(
        `<b>INSAT-3DS ~4 km Tripwire Zone</b><br>${item.village}<br>${item.insatSpike}<br><i>Click to zoom & inspect</i>`,
        { className: 'custom-tooltip' }
      );
      rect.on('click', () => selectCase(index));
    }

    if (Array.isArray(item.fieldPoly) && item.fieldPoly.length >= 3) {
      const poly = L.polygon(item.fieldPoly, {
        color: "#ffffff",
        weight: 2,
        fillColor: item.polyColor,
        fillOpacity: 0.85
      }).addTo(eveningLayerGroup);

      poly.bindTooltip(
        `<b>${item.id}: ${item.ruleDecision}</b><br>Click to view Evidence Pack`,
        { className: 'custom-tooltip' }
      );
      poly.on('click', () => selectCase(index));
    }
  });
}

// =============================================
// CONFIDENCE BAR HELPER
// =============================================
function getConfidenceBarHTML(value, decision) {
  if (value === 0 && decision === "Re-check next clear pass") {
    return `
      <div class="confidence-bar-container">
        <div class="confidence-bar-bg">
          <div class="confidence-bar-fill confidence-queued" style="width: 100%; opacity: 0.4;"></div>
        </div>
      </div>`;
  }

  let colorClass = 'confidence-low';
  if (value >= 75) colorClass = 'confidence-high';
  else if (value >= 40) colorClass = 'confidence-medium';

  return `
    <div class="confidence-bar-container">
      <div class="confidence-bar-bg">
        <div class="confidence-bar-fill ${colorClass}" style="width: ${value}%;"></div>
      </div>
    </div>`;
}

// =============================================
// EVIDENCE PACK PANEL RENDERING
// =============================================
function renderEvidencePack(index) {
  activeCaseIndex = index;
  const c = casesData[index];
  const container = document.getElementById('evidenceContainer');

  const listHtml = casesData.map((item, idx) => `
    <div class="case-list-item ${idx === index ? 'active-case' : ''}"
         onclick="selectCase(${idx})"
         tabindex="0"
         role="button"
         aria-label="Select case ${item.id}"
         onkeydown="if(event.key==='Enter')selectCase(${idx})">
      <span><strong>${item.id}</strong> — ${item.village}</span>
      <span class="decision-badge ${item.badgeClass}">${item.ruleDecision}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="evidence-card">
      <div class="card-top">
        <div>
          <span class="case-id">${c.id}</span>
          <h3>${c.village}</h3>
        </div>
        <span class="decision-badge ${c.badgeClass}">${c.ruleDecision}</span>
      </div>

      <div class="signal-box">
        <span class="signal-label">1. Watch & Flag — INSAT-3DS ~4 km Tripwire</span>
        <strong style="color: #fb923c;">${c.insatSpike}</strong>
      </div>

      <div class="signal-box">
        <span class="signal-label">2. Confirm — Sentinel-2 10 m Burnt-Field Map</span>
        <strong style="color: #38bdf8;">${c.sentinelScar}</strong>
      </div>

      <div class="before-after-grid">
        <div class="img-box">
          <div class="patch-preview patch-green"></div>
          <strong>Before Photo</strong>
          <div style="color: #94a3b8; margin-top: 4px; font-size: 11px;">${c.beforeLabel}</div>
        </div>
        <div class="img-box">
          <div class="patch-preview ${c.afterPatchClass}"></div>
          <strong>After Photo</strong>
          <div style="color: #94a3b8; margin-top: 4px; font-size: 11px;">${c.afterLabel}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div>
          <span class="signal-label">Burnt Area</span>
          <strong>${c.burntArea}</strong>
        </div>
        <div>
          <span class="signal-label">Confidence</span>
          <strong>${c.confidence}</strong>
          ${getConfidenceBarHTML(c.confidenceValue || 0, c.ruleDecision)}
        </div>
        <div class="meta-full">
          <span class="signal-label">Officer Verification</span>
          <strong style="color: #34d399;">${c.status}</strong>
        </div>
      </div>

      <div class="gov-note">
        🛡️ No automatic penalties — a human verifies every case on the field before any action.
      </div>

      <div class="btn-row">
        <button class="action-btn green-btn" onclick="verifyCase(${index}, 'Verified by Officer on Field')">
          ✅ Field Check Confirmed
        </button>
        <button class="action-btn gray-btn" onclick="verifyCase(${index}, 'Marked False Alarm — Re-checked')">
          ❌ Mark False Alarm
        </button>
      </div>
    </div>

    <div>
      <div class="case-list-header">Verified Case List (${casesData.length})</div>
      ${listHtml}
    </div>
  `;
}

// =============================================
// CASE SELECTION & MAP NAVIGATION
// =============================================
function selectCase(index) {
  map.flyTo(casesData[index].coords, 14, { duration: 0.7 });
  renderEvidencePack(index);
}

// =============================================
// OFFICER VERIFICATION
// =============================================
async function verifyCase(index, verdict) {
  casesData[index].status = verdict;
  renderEvidencePack(index);
  
  const isConfirmed = verdict.includes('Verified');
  showToast(
    `${casesData[index].id}: ${verdict}`,
    isConfirmed ? 'success' : 'info'
  );

  try {
    await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: casesData[index].id, status: verdict })
    });
  } catch (err) {
    // Fallback when running without backend server
  }
}

// =============================================
// OBSERVATION MODE TOGGLE
// =============================================
function setObservationMode(mode) {
  const btnMidday = document.getElementById('btnMidday');
  const btnEvening = document.getElementById('btnEvening');
  const banner = document.getElementById('modeBanner');

  if (mode === 'midday') {
    map.removeLayer(eveningLayerGroup);
    btnMidday.classList.add('active');
    btnMidday.setAttribute('aria-selected', 'true');
    btnEvening.classList.remove('active');
    btnEvening.setAttribute('aria-selected', 'false');
    banner.innerHTML = "⚠️ <strong>Midday Pass (~10:30 am to 1:30 pm | MODIS & VIIRS):</strong> 0 Evening Fires Counted — Satellites look when farmers are not burning!";
    updateStatusCounters('midday');
  } else {
    eveningLayerGroup.addTo(map);
    btnEvening.classList.add('active');
    btnEvening.setAttribute('aria-selected', 'true');
    btnMidday.classList.remove('active');
    btnMidday.setAttribute('aria-selected', 'false');
    banner.innerHTML = "⚡ <strong>Active Watch:</strong> INSAT-3DS thermal scans every 30 minutes (~4 km tripwire) + Sentinel-2 (10 m) before/after field check";
    updateStatusCounters('evening');
  }
}

// =============================================
// PORTAL SWITCHING
// =============================================
function switchPortal(portal) {
  const officerPortal = document.getElementById('officerPortal');
  const farmerPortal = document.getElementById('farmerPortal');
  const tabOfficer = document.getElementById('tabOfficer');
  const tabFarmer = document.getElementById('tabFarmer');

  if (portal === 'officer') {
    officerPortal.classList.remove('hidden');
    farmerPortal.classList.add('hidden');
    tabOfficer.classList.add('active-tab');
    tabOfficer.setAttribute('aria-selected', 'true');
    tabFarmer.classList.remove('active-tab');
    tabFarmer.setAttribute('aria-selected', 'false');
    setTimeout(() => map.invalidateSize(), 100);
  } else {
    officerPortal.classList.add('hidden');
    farmerPortal.classList.remove('hidden');
    tabFarmer.classList.add('active-tab');
    tabFarmer.setAttribute('aria-selected', 'true');
    tabOfficer.classList.remove('active-tab');
    tabOfficer.setAttribute('aria-selected', 'false');
  }
}

// =============================================
// SIDEBAR TOGGLE
// =============================================
function toggleSidebar() {
  const layout = document.getElementById('officerPortal');
  const icon = document.getElementById('toggleIcon');
  sidebarOpen = !sidebarOpen;

  if (sidebarOpen) {
    layout.classList.remove('sidebar-collapsed');
    icon.textContent = '◀';
  } else {
    layout.classList.add('sidebar-collapsed');
    icon.textContent = '▶';
  }

  // Let Leaflet recalculate map size after CSS transition
  setTimeout(() => map.invalidateSize(), 300);
}

// =============================================
// FARMER PORTAL ACTIONS (TOAST INSTEAD OF ALERT)
// =============================================
function bookOption(optionName) {
  showToast(`Request sent for: ${optionName}`, 'success');
}

// =============================================
// START APP
// =============================================
loadCases();