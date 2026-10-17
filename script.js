// AgniDrishti officer map: self-contained evidence prototypes (Vanilla JS + Leaflet)
const map = L.map('map', { zoomControl: false }).setView([30.12, 75.91], 10);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri | AgniDrishti (INSAT-3DS + Sentinel-2)' }).addTo(map);
const insatLayerGroup = L.layerGroup();
const sentinelLayerGroup = L.layerGroup();
const markerLayerGroup = L.layerGroup();
const windPlumeLayerGroup = L.layerGroup();
let activeCaseIndex = 0, sidebarOpen = true, activeObservationMode = 'fusion', activeStatusFilter = 'all', windPlumeVisible = false;
const dispatchedCases = new Set(), smogPenetrationCases = new Set();

// Canonical evidence records: two confirmed, one false alarm, one caught late, one haze queue.
const casesData = [
  { id:'CASE-SGR-101', village:'Dirba Block, Sangrur', khasra:'Khasra #142//8', acreage:'3.2 Acres', coords:[30.0682,75.9864], zoneBounds:[[30.0502,75.9624],[30.0862,76.0104]], fieldPoly:[[30.0658,75.9835],[30.0658,75.9892],[30.0705,75.9892],[30.0705,75.9835]], ruleDecision:'Confirmed', badgeClass:'badge-confirmed', polyColor:'#dc2626', stateIcon:'🔴', peakTime:'16:30', peakK:348.4, viirsK:303.1, dnbr:'+0.49', ndvi:'0.58 → 0.11', insatSpike:'16:30 IST • 348.4 K heat spike', sentinelScar:'10 m SWIR burn scar confirmed (dNBR +0.49)', status:'Evidence ready for field verification', confidence:'High fusion agreement', afterType:'burnt' },
  { id:'CASE-SUN-102', village:'Sunam East, Sangrur', khasra:'Khasra #89//14', acreage:'4.5 Acres', coords:[30.1285,75.8012], zoneBounds:[[30.1105,75.7772],[30.1465,75.8252]], fieldPoly:[[30.1261,75.7983],[30.1261,75.8040],[30.1308,75.8040],[30.1308,75.7983]], ruleDecision:'Confirmed', badgeClass:'badge-confirmed', polyColor:'#dc2626', stateIcon:'🔴', peakTime:'17:00', peakK:352.0, viirsK:304.0, dnbr:'+0.54', ndvi:'0.61 → 0.09', insatSpike:'17:00 IST • 352.0 K heat spike', sentinelScar:'10 m SWIR burn scar confirmed (dNBR +0.54)', status:'Evidence ready for field verification', confidence:'High fusion agreement', afterType:'burnt' },
  { id:'CASE-BNL-103', village:'Handiaya Industrial Belt, Barnala', khasra:'Grid #B-19', acreage:'Industrial grid', coords:[30.3410,75.5480], zoneBounds:[[30.3230,75.5240],[30.3590,75.5720]], fieldPoly:[[30.3386,75.5451],[30.3386,75.5508],[30.3433,75.5508],[30.3433,75.5451]], ruleDecision:'False Alarm', badgeClass:'badge-false', polyColor:'#eab308', stateIcon:'🟡', peakTime:'15:00', peakK:339.2, viirsK:301.8, dnbr:'+0.02', ndvi:'0.44 → 0.43', insatSpike:'15:00 IST • 339.2 K thermal source', sentinelScar:'No crop burn scar — brick kiln signature (dNBR +0.02)', status:'Auto-cleared from farmer enforcement queue', confidence:'Thermal / optical mismatch', afterType:'industrial' },
  { id:'CASE-PTL-104', village:'Nabha Rural, Patiala', khasra:'Khasra #211//3', acreage:'2.1 Acres', coords:[30.3752,76.1520], zoneBounds:null, fieldPoly:[[30.3728,76.1491],[30.3728,76.1548],[30.3775,76.1548],[30.3775,76.1491]], ruleDecision:'Caught Late', badgeClass:'badge-late', polyColor:'#0ea5e9', stateIcon:'🔵', peakTime:null, peakK:null, viirsK:302.6, dnbr:'+0.41', ndvi:'0.56 → 0.14', insatSpike:'No INSAT-3DS spike above 330 K', sentinelScar:'Next clear pass found 10 m ash scar (dNBR +0.41)', status:'Post-pass evidence awaiting field verification', confidence:'Sentinel-2 scar evidence', afterType:'burnt' },
  { id:'CASE-SGR-105', village:'Moonak Border, Sangrur', khasra:'Sector #M-07', acreage:'Plot geometry pending clear view', coords:[29.8240,75.8910], zoneBounds:[[29.8060,75.8670],[29.8420,75.9150]], fieldPoly:[[29.8216,75.8881],[29.8216,75.8938],[29.8263,75.8938],[29.8263,75.8881]], ruleDecision:'Haze Queue', badgeClass:'badge-haze', polyColor:'#a855f7', stateIcon:'☁️', peakTime:'18:00', peakK:344.8, viirsK:302.3, dnbr:'Pending optical clearance', ndvi:'Optical view blocked', insatSpike:'18:00 IST • 344.8 K heat spike', sentinelScar:'RGB blocked: 78% smog • AOD 1.92', status:'Haze queue — no action until alternate evidence is reviewed', confidence:'SWIR / SAR review required', afterType:'haze' }
];

function showToast(message, type='info', duration=3500) { const container=document.getElementById('toastContainer'), toast=document.createElement('div'); toast.className=`toast toast-${type}`; toast.innerHTML=`<span>${type==='success'?'✅':'ℹ️'}</span><span>${message}</span>`; container.appendChild(toast); setTimeout(()=>{toast.classList.add('toast-exit');setTimeout(()=>toast.remove(),300)},duration); }
function updateStatusCounters() {
  const counts = { Confirmed: 2, 'False Alarm': 1, 'Caught Late': 1, 'Haze Queue': 1 };
  document.getElementById('statConfirmed').textContent = counts.Confirmed;
  document.getElementById('statFalseAlarm').textContent = counts['False Alarm'];
  document.getElementById('statCaughtLate').textContent = counts['Caught Late'];
  document.getElementById('statHaze').textContent = counts['Haze Queue'];
}

function isVisibleCase(item) { return activeStatusFilter === 'all' || item.ruleDecision === activeStatusFilter; }
function kelvinLabel(item) { return item.peakK ? `${item.peakK} K` : '≤330 K'; }

function renderMapLayers() {
  [insatLayerGroup, sentinelLayerGroup, markerLayerGroup].forEach(group => group.clearLayers());
  casesData.forEach((item, index) => {
    if (!isVisibleCase(item)) return;
    if (item.zoneBounds) {
      const rect = L.rectangle(item.zoneBounds, { color:'#fb923c', weight:2, dashArray:'7, 6', fillColor:'#f97316', fillOpacity:.18, className:'thermal-cell' }).addTo(insatLayerGroup);
      rect.bindTooltip(`<b>${kelvinLabel(item)} · INSAT-3DS</b><br>${item.village}<br>${item.insatSpike}`, { className:'thermal-tooltip', permanent:activeObservationMode==='insat', direction:'center', opacity:.94 });
      rect.on('click', () => selectCase(index));
    }
    const poly = L.polygon(item.fieldPoly, { color:'#fff', weight:2, fillColor:item.polyColor, fillOpacity:.86, className:'sentinel-plot' }).addTo(sentinelLayerGroup);
    poly.bindTooltip(`<b>${item.khasra}</b><br>dNBR ${item.dnbr}<br>${item.ruleDecision}`, { className:'sentinel-tooltip', permanent:activeObservationMode==='sentinel', direction:'center', opacity:.94 });
    poly.on('click', () => selectCase(index));
    const marker = L.circleMarker(item.coords, { radius:7, color:'#fff', weight:2, fillColor:item.polyColor, fillOpacity:1, className:'case-marker' }).addTo(markerLayerGroup);
    marker.bindTooltip(`<b>${item.id}</b><br>${item.village}<br>Click to open evidence`, { className:'custom-tooltip' });
    marker.on('click', () => selectCase(index));
  });
  applyObservationLayers();
}

function applyObservationLayers() {
  [insatLayerGroup, sentinelLayerGroup, markerLayerGroup].forEach(group => { if (map.hasLayer(group)) map.removeLayer(group); });
  if (activeObservationMode === 'fusion') { insatLayerGroup.addTo(map); sentinelLayerGroup.addTo(map); markerLayerGroup.addTo(map); }
  if (activeObservationMode === 'insat') { insatLayerGroup.addTo(map); markerLayerGroup.addTo(map); }
  if (activeObservationMode === 'sentinel') { sentinelLayerGroup.addTo(map); markerLayerGroup.addTo(map); }
}

function thermalReadings(c) { const peakIndex=c.peakTime?Number(c.peakTime.slice(0,2))*2+Number(c.peakTime.slice(3))/30:-1; return Array.from({length:48},(_,i)=>{const daylight=Math.max(0,Math.sin(((i/2-5.5)/13)*Math.PI));let value=286+daylight*20+(i%3-1)*.7;if(peakIndex>=0){const d=Math.abs(i-peakIndex);if(d===0)value=c.peakK;else if(d===1)value+=(c.peakK-value)*.38;else if(d===2)value+=(c.peakK-value)*.12;}return Number(value.toFixed(1));}); }
function thermalChart(c) { const values=thermalReadings(c), w=356,h=154,p={l:30,r:8,t:14,b:24},min=275,max=360,x=i=>p.l+i*(w-p.l-p.r)/47,y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min),points=values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '),viirs=27,peak=c.peakTime?Number(c.peakTime.slice(0,2))*2+Number(c.peakTime.slice(3))/30:-1; const grid=[280,320,360].map(v=>`<line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" class="thermal-grid"/><text x="2" y="${y(v)+3}" class="thermal-axis">${v}</text>`).join('');const marker=peak>=0?`<circle cx="${x(peak)}" cy="${y(values[peak])}" r="4" class="thermal-peak"/><text x="${Math.min(x(peak)+6,270)}" y="${Math.max(y(values[peak])-8,13)}" class="thermal-annotation">${c.peakTime} • ${c.peakK} K</text>`:`<text x="156" y="31" class="thermal-annotation thermal-calm">No &gt;330 K tripwire spike</text>`; return `<section class="thermal-panel" aria-label="24 hour INSAT-3DS thermal chart"><div class="evidence-section-head"><span>24-hour INSAT-3DS thermal trace</span><small>3.9 µm MIR · 30 min scans</small></div><svg class="thermal-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Thermal trace from 00:00 to 23:30 IST">${grid}<line x1="${x(viirs)}" y1="${p.t}" x2="${x(viirs)}" y2="${h-p.b}" class="viirs-line"/><polyline points="${points}" class="thermal-line"/>${marker}<text x="${x(viirs)-30}" y="${h-5}" class="viirs-label">13:30 VIIRS (missed)</text><text x="${p.l}" y="${h-5}" class="thermal-axis">00:00</text><text x="${w-39}" y="${h-5}" class="thermal-axis">23:30</text></svg><div class="thermal-summary"><span class="viirs-key">Dashed: 13:30 IST VIIRS pass ${c.viirsK} K</span><span>${c.peakTime?`Peak: ${c.peakTime} IST @ ${c.peakK} K`:'Late scar found on next clear Sentinel-2 pass'}</span></div></section>`; }

function splitSlider(c) { const active=smogPenetrationCases.has(c.id), post=c.afterType==='haze'?(active?'SWIR / SAR alternate evidence':'Post-pass optical blocked by smog'):c.afterType==='industrial'?'Post-pass: no crop scar':'Post-pass Sentinel-2 10 m SWIR burn scar'; return `<section class="split-section"><div class="evidence-section-head"><span>Before / after burn-scar comparison</span><small>Drag to compare</small></div><div class="split-comparison ${c.afterType}" id="split-${c.id}" style="--split:50%"><div class="scene scene-before"><span>Pre-pass · Golden Stubble</span><i></i><i></i><i></i></div><div class="scene scene-after"><span>${post}</span><i></i><i></i><i></i></div><div class="split-divider"><b>↔</b></div></div><input class="split-range" aria-label="Adjust before and after comparison" type="range" min="0" max="100" value="50" oninput="setEvidenceSplit('${c.id}',this.value)"><div class="split-meta"><span>${c.khasra} · ${c.acreage}</span><span>dNBR ${c.dnbr}</span><span>NDVI ${c.ndvi}</span></div>${c.afterType==='haze'?`<button class="smog-toggle ${active?'active':''}" onclick="toggleSmogPenetration('${c.id}')">${active?'✓ SWIR 2190 nm / Sentinel-1 SAR Penetration Active':'Activate SWIR 2190nm / Sentinel-1 SAR Smog Penetration'}</button>`:''}</section>`; }

function renderEvidencePack(index) { activeCaseIndex=index; const c=casesData[index], dispatched=dispatchedCases.has(c.id), container=document.getElementById('evidenceContainer'); const visibleCases=casesData.map((item,idx)=>({item,idx})).filter(({item})=>isVisibleCase(item)); const list=visibleCases.map(({item,idx})=>`<button class="case-list-item ${idx===index?'active-case':''}" onclick="selectCase(${idx})" aria-label="Select ${item.id}"><span><strong>${item.id}</strong><small>${item.village}</small></span><span class="decision-badge ${item.badgeClass}">${item.stateIcon} ${item.ruleDecision}</span></button>`).join(''); container.innerHTML=`<div class="evidence-card deep-evidence-card"><div class="card-top"><div><span class="case-id">${c.id}</span><h3>${c.village}</h3><p>${c.khasra} · ${c.acreage}</p></div><span class="decision-badge ${c.badgeClass}">${c.stateIcon} ${c.ruleDecision}</span></div><div class="signal-strip"><div><span>INSAT-3DS tripwire</span><strong>${c.insatSpike}</strong></div><div><span>Sentinel-2 plot check</span><strong>${c.sentinelScar}</strong></div></div>${thermalChart(c)}${splitSlider(c)}<div class="verification-strip"><span>🛡️ No automatic penalties</span><strong>${dispatched?'● Nodal officer dispatched':c.status}</strong></div><div class="btn-row evidence-actions"><button class="action-btn green-btn ${dispatched?'dispatched':''}" onclick="toggleDispatch(${index})">${dispatched?'✓ Nodal Officer Dispatched — Recall':'Dispatch Nodal Officer'}</button><button class="action-btn blue-btn" onclick="openDossier(${index})">Export Official Evidence Dossier</button></div></div><div class="case-list-wrap"><div class="case-list-header">${activeStatusFilter==='all'?'Evidence cases':'Filtered evidence'} · ${visibleCases.length}</div>${list}</div>`; }
function setEvidenceSplit(id,value){const split=document.getElementById(`split-${id}`);if(split)split.style.setProperty('--split',`${value}%`)}
function toggleSmogPenetration(id){smogPenetrationCases.has(id)?smogPenetrationCases.delete(id):smogPenetrationCases.add(id);renderEvidencePack(activeCaseIndex);showToast(smogPenetrationCases.has(id)?'SWIR 2190 nm and Sentinel-1 SAR review activated.':'Alternate smog penetration review paused.','success')}
function toggleDispatch(index){const c=casesData[index];dispatchedCases.has(c.id)?dispatchedCases.delete(c.id):dispatchedCases.add(c.id);renderEvidencePack(index);showToast(dispatchedCases.has(c.id)?`${c.id}: Nodal officer dispatched with evidence pack.`:`${c.id}: Officer dispatch recalled.`,dispatchedCases.has(c.id)?'success':'info')}

function qrSvg(id){let seed=[...id].reduce((n,char)=>n+char.charCodeAt(0),0),cells='';for(let row=0;row<21;row++)for(let col=0;col<21;col++){const finder=(row<7&&col<7)||(row<7&&col>13)||(row>13&&col<7),value=finder?((row%6===0||col%6===0||(row>1&&row<5&&col>1&&col<5))?1:0):((seed+row*13+col*7+row*col)%5<2?1:0);if(value)cells+=`<rect x="${col}" y="${row}" width="1" height="1"/>`}return `<svg class="qr-code" viewBox="0 0 21 21" aria-label="QR verification code">${cells}</svg>`}
function openDossier(index){const c=casesData[index];document.getElementById('dossierModal')?.remove();const modal=document.createElement('div');modal.id='dossierModal';modal.className='dossier-modal';modal.innerHTML=`<div class="dossier-sheet" role="dialog" aria-modal="true" aria-label="Official evidence dossier"><button class="modal-close no-print" onclick="closeDossier()" aria-label="Close dossier">×</button><header><div><p>AGNI DRISHTI · OFFICER EVIDENCE DOSSIER</p><h2>${c.id}</h2><span>${c.ruleDecision} evidence — human verification required</span></div>${qrSvg(c.id)}</header><section><h3>Plot identification</h3><dl><div><dt>Location</dt><dd>${c.village}</dd></div><div><dt>Khasra / grid</dt><dd>${c.khasra}</dd></div><div><dt>Area</dt><dd>${c.acreage}</dd></div><div><dt>Coordinates</dt><dd>${c.coords[0]}, ${c.coords[1]}</dd></div></dl></section><section><h3>Satellite pass metadata</h3><dl><div><dt>INSAT-3DS</dt><dd>${c.insatSpike}</dd></div><div><dt>VIIRS pass</dt><dd>13:30 IST · ${c.viirsK} K · missed late event</dd></div><div><dt>Sentinel-2 10 m</dt><dd>${c.sentinelScar}</dd></div><div><dt>Change indicators</dt><dd>dNBR ${c.dnbr} · NDVI ${c.ndvi}</dd></div></dl></section><aside class="dossier-note">Verification QR: ${c.id}-INSAT3DS-S2 · This dossier supports field verification and does not authorize an automatic penalty.</aside><footer><span>Generated local evidence prototype · 30-min thermal fusion</span><button class="action-btn green-btn no-print" onclick="window.print()">Print dossier</button></footer></div>`;document.body.appendChild(modal);modal.querySelector('.modal-close').focus()}
function closeDossier(){document.getElementById('dossierModal')?.remove()}

function selectCase(index){
  activeCaseIndex=index;
  if (!isVisibleCase(casesData[index])) activeStatusFilter='all';
  updateStatusFilterButtons();
  renderMapLayers();
  map.flyTo(casesData[index].coords,13,{duration:.7});
  renderEvidencePack(index);
}

function setObservationMode(mode){
  activeObservationMode=mode;
  const modeMeta={
    fusion:'🛰️ <strong>Combined Fusion:</strong> INSAT-3DS ~4 km thermal tripwire cells + Sentinel-2 10 m Khasra plots.',
    insat:'🔥 <strong>INSAT-3DS Thermal (~4 km):</strong> Pulsing 30-minute MIR heat cells with Kelvin labels.',
    sentinel:'🗺️ <strong>Sentinel-2 10m Burn Scar:</strong> High-resolution Khasra polygons and dNBR evidence.'
  };
  ['fusion','insat','sentinel'].forEach(key=>{const button=document.getElementById(`btn${key[0].toUpperCase()}${key.slice(1)}`);const active=key===mode;button.classList.toggle('active',active);button.setAttribute('aria-selected',active);});
  document.getElementById('modeBanner').innerHTML=modeMeta[mode];
  renderMapLayers();
}

function updateStatusFilterButtons(){
  const ids={Confirmed:'filter-confirmed','False Alarm':'filter-false','Caught Late':'filter-late','Haze Queue':'filter-haze'};
  Object.entries(ids).forEach(([status,id])=>document.getElementById(id).classList.toggle('active-filter',activeStatusFilter===status));
}

function setStatusFilter(status){
  activeStatusFilter=activeStatusFilter===status?'all':status;
  const firstMatch=casesData.findIndex(item=>isVisibleCase(item));
  if(firstMatch>=0) activeCaseIndex=firstMatch;
  updateStatusFilterButtons();
  renderMapLayers();
  renderEvidencePack(activeCaseIndex);
  showToast(activeStatusFilter==='all'?'Showing all evidence cases.':`Filtering map and evidence pack: ${activeStatusFilter}.`,'info');
}

function toggleWindPlume(){
  windPlumeVisible=!windPlumeVisible;
  const toggle=document.getElementById('windPlumeToggle');
  toggle.classList.toggle('active',windPlumeVisible);
  toggle.setAttribute('aria-pressed',windPlumeVisible);
  if(windPlumeVisible){
    windPlumeLayerGroup.clearLayers();
    const route=[[30.0682,75.9864],[30.16,76.12],[30.30,76.34],[30.44,76.60]];
    L.polyline(route,{color:'#cbd5e1',weight:3,dashArray:'9,8',className:'wind-plume-path'}).addTo(windPlumeLayerGroup);
    L.marker(route[2],{interactive:false,icon:L.divIcon({className:'wind-arrow-icon',html:'➜',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(windPlumeLayerGroup);
    L.marker(route[0],{interactive:false,icon:L.divIcon({className:'wind-plume-label',html:'🌬️ <strong>NW Wind 14 km/h</strong><br>→ Plume trajectory toward Patiala / NCR',iconSize:[220,48],iconAnchor:[10,45]})}).addTo(windPlumeLayerGroup);
    windPlumeLayerGroup.addTo(map);
    showToast('Wind & smoke plume vector enabled.','info');
  } else { map.removeLayer(windPlumeLayerGroup); }
}
function switchPortal(portal){
  const officer=portal==='officer';
  document.body.classList.toggle('farmer-view-active',!officer);
  document.getElementById('officerPortal').classList.toggle('hidden',!officer);
  document.getElementById('farmerPortal').classList.toggle('hidden',officer);
  document.getElementById('tabOfficer').classList.toggle('active-tab',officer);
  document.getElementById('tabFarmer').classList.toggle('active-tab',!officer);
  document.getElementById('tabOfficer').setAttribute('aria-selected',officer);
  document.getElementById('tabFarmer').setAttribute('aria-selected',!officer);
  const modeSwitch=document.getElementById('satelliteModeSwitch');
  if(modeSwitch) modeSwitch.classList.toggle('hidden',!officer);
  const statusBar=document.getElementById('officerStatusBar');
  if(statusBar) statusBar.classList.toggle('hidden',!officer);
  if(officer)setTimeout(()=>map.invalidateSize(),100);
}
function toggleSidebar(){sidebarOpen=!sidebarOpen;document.getElementById('officerPortal').classList.toggle('sidebar-collapsed',!sidebarOpen);document.getElementById('toggleIcon').textContent=sidebarOpen?'◀':'▶';setTimeout(()=>map.invalidateSize(),300)}
function bookOption(optionName){showToast(`Request sent for: ${optionName}`,'success')}

updateStatusCounters();renderMapLayers();renderEvidencePack(0);

// Stage-1 farmer intervention state. These flows stay usable without an API connection.
let selectedAcreage = 5;

const CALC = {
  STRAW_QTL_PER_ACRE: 17,      // reported 15.2-19.5 q/acre (JADP 2024 Punjab study); 17-18 (HT)
  PLANT_RATE_PER_QTL: 169,     // biomass plant rate to balers; Rs160-170 reported 2025 (Tribune)
  BALING_COST_PER_QTL: 147,    // Rs147.37/qtl baling cost (JADP 2024), proxy for baling+transport
  NUTRIENT_VALUE_PER_QTL: 148, // per tonne: 5.5kg N + 2.3kg P2O5 + 25kg K2O at MRP prices
                               // (urea 266.5/45kg, DAP 1350/50kg, MOP 1534/50kg) = ~Rs1,484/t.
                               // Conservative option (N + P2O5 only): 21
};
// CAQM environmental compensation, per incident, by landholding (Amendment Rules, Nov 2024)
function compensation(acres) {
  if (acres < 2) return 5000;
  if (acres <= 5) return 10000;  // rule text skips exactly 5 acres; treated as 10000
  return 30000;
}
const STRAW_PER_ACRE = CALC.STRAW_QTL_PER_ACRE;

function formatRupees(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

let currentFarmerLanguage = 'en';
try {
  const savedLang = localStorage.getItem('agnidrishti_farmer_lang');
  if (savedLang && ['en', 'pa', 'hi'].includes(savedLang)) {
    currentFarmerLanguage = savedLang;
  }
} catch (e) {}

const farmerTranslations = {
  en: {
    portalTab: '🌾 Farmer Alert Page',
    badge: '🟢 Live Stage-1 Pre-Burn Intervention · Triggered by Sentinel-2 Harvest NDVI Drop (72h Before Burn Window)',
    title: '🌾 Simple Farmer Alert Page',
    desc: 'Nearby machine or crop-residue buyer options so farmers get practical support before burning happens.',
    calcKicker: 'Stage-1 decision support',
    calcTitle: 'Stubble Cash Payout vs Burning Cost Calculator',
    calcDesc: 'Set your harvested acreage to see the value of collection before the burn window.',
    acresUnit: 'Acres',
    scaleMin: '1 acre',
    scaleMax: '50 acres',
    resStrawLabel: 'Estimated Straw',
    resStrawSub: '17 quintals per acre (reported 15-19.5)',
    qtlUnit: 'qtl',
    resCashLabel: 'Net Straw Value if Baled & Sold (est.)',
    resCashSub: (gross, baling) => `${gross} gross - ${baling} baling @ ₹169/qtl`,
    resSavingsLabel: 'Soil Nutrients + CAQM Compensation',
    savingsDetail: (nutrients, comp) => `${nutrients} nutrients + up to ${comp} compensation`,

    // Machines
    machinesHeaderTitle: '🚜 Nearby Stubble Management Machines',
    machinesAvailableBadge: '2 Available',
    dirbaChcName: 'Dirba Co-op Society CHC',
    dirbaChcDesc: '3 Happy Seeders • 2 Straw Balers Available',
    dirbaChcDist: '📍 2.1 km from ~4 km flagged zone',
    reserveSlotBtn: '<span>🚜</span> Reserve Free Machine Slot',

    sunamChcName: 'Sunam Agro Machinery Hub',
    sunamChcDesc: '4 Super SMS • 1 Zero-Till Drill Available',
    sunamChcDist: '📍 3.8 km from ~4 km flagged zone',

    // Buyers
    buyersHeaderTitle: '🏭 Nearby Crop-Residue Buyers',
    buyersCountBadge: '3 Buyers',

    sangrurBuyerName: 'Sangrur Bio-CNG Plant',
    sangrurBuyerDesc: 'Buying baled paddy straw @ ₹180 / quintal',
    sangrurBuyerDist: '📍 4.5 km away · Pickup available',
    schedulePickupBtn: '<span>🚚</span> Schedule Farm-Gate Pickup',

    barnalaBuyerName: 'Barnala Biomass Pellet Unit',
    barnalaBuyerDesc: 'Buying loose straw @ ₹140 / quintal',
    barnalaBuyerDist: '📍 6.2 km away · Self-delivery',

    patialaBuyerName: 'Patiala Paper Mill Co-op',
    patialaBuyerDesc: 'Buying baled rice straw @ ₹160 / quintal',
    patialaBuyerDist: '📍 12 km away · Bulk pickup Thu & Sat',

    // Helpline
    helplineText: '📞 Need help? Call the Crop Residue Management Helpline: <strong>1800-180-1551</strong> (Toll Free)',

    // Confirmation Modals
    modalCloseAria: 'Close confirmation',
    modalDoneBtn: 'Done',
    modalLabel: 'Stage-1 intervention confirmed',

    machineModalTitle: 'Free machine slot reserved',
    labelChc: 'Custom Hiring Centre',
    labelBookingToken: 'Booking token',
    labelReservedSlot: 'Reserved time slot',
    labelServiceFee: 'Service fee',
    freeReservationVal: 'Free reservation',
    machineModalNote: 'Your CHC will hold this slot while the field team coordinates machine delivery.',
    machineToast: (centre) => `${centre}: free machine slot reserved.`,
    timeSlotDirba: 'Today · 10:00–12:00 IST',
    timeSlotSunam: 'Today · 14:00–16:00 IST',

    buyerModalTitle: 'Farm-gate pickup scheduled',
    labelBuyer: 'Residue buyer',
    labelSelectedArea: 'Selected area',
    areaEstimatedNote: (ac, qtl) => `${ac} acres · ${qtl} qtl estimated`,
    labelConfirmedPayout: 'Confirmed cash payout',
    payoutRateNote: (rate) => `@ ₹${rate}/qtl`,
    labelPickupWindow: 'Pickup window',
    buyerModalNote: 'Keep the residue accessible at the farm gate. The buyer will confirm the vehicle before arrival.',
    buyerToast: (buyer, payout) => `${buyer}: pickup scheduled for ${payout}.`,
    timeSlotSangrur: 'Tomorrow · 08:00–11:00 IST',
    timeSlotBarnala: 'Tomorrow · 11:30–14:30 IST',
    timeSlotPatiala: 'Thursday · 09:00–12:00 IST'
  },
  pa: {
    portalTab: '🌾 ਕਿਸਾਨ ਅਲਰਟ ਪੇਜ',
    badge: '🟢 ਲਾਈਵ ਸਟੇਜ-1 ਅੱਗ ਲੱਗਣ ਤੋਂ ਪਹਿਲਾਂ ਦਖਲਅੰਦਾਜ਼ੀ · ਸੈਂਟੀਨਲ-2 ਵਾਢੀ NDVI ਗਿਰਾਵਟ ਦੁਆਰਾ ਸ਼ੁਰੂ (ਸਾੜਨ ਤੋਂ 72 ਘੰਟੇ ਪਹਿਲਾਂ)',
    title: '🌾 ਸਰਲ ਕਿਸਾਨ ਅਲਰਟ ਪੇਜ',
    desc: 'ਨੇੜਲੀਆਂ ਮਸ਼ੀਨਾਂ ਜਾਂ ਪਰਾਲੀ ਖਰੀਦਦਾਰਾਂ ਦੇ ਵਿਕਲਪ ਤਾਂ ਜੋ ਅੱਗ ਲਗਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਕਿਸਾਨਾਂ ਨੂੰ ਅਮਲੀ ਸਹਾਇਤਾ ਮਿਲ ਸਕੇ।',
    calcKicker: 'ਸਟੇਜ-1 ਫੈਸਲਾ ਸਹਾਇਤਾ',
    calcTitle: 'ਪਰਾਲੀ ਨਕਦ ਭੁਗਤਾਨ ਬਨਾਮ ਸਾੜਨ ਦੀ ਲਾਗਤ ਕੈਲਕੁਲੇਟਰ',
    calcDesc: 'ਸਾੜਨ ਦੇ ਸਮੇਂ ਤੋਂ ਪਹਿਲਾਂ ਪਰਾਲੀ ਇਕੱਠੀ ਕਰਨ ਦੀ ਕੀਮਤ ਦੇਖਣ ਲਈ ਆਪਣਾ ਕਟਾਈ ਵਾਲਾ ਰਕਬਾ ਸੈੱਟ ਕਰੋ।',
    acresUnit: 'ਏਕੜ',
    scaleMin: '1 ਏਕੜ',
    scaleMax: '50 ਏਕੜ',
    resStrawLabel: 'ਅੰਦਾਜ਼ਨ ਪਰਾਲੀ',
    resStrawSub: '17 ਕੁਇੰਟਲ ਪ੍ਰਤੀ ਏਕੜ (ਰਿਪੋਰਟ ਅਨੁਸਾਰ 15-19.5)',
    qtlUnit: 'ਕੁਇੰਟਲ',
    resCashLabel: 'ਪਰਾਲੀ ਵੇਚਣ ਤੋਂ ਸ਼ੁੱਧ ਮੁੱਲ (ਅੰਦਾਜ਼ਨ)',
    resCashSub: (gross, baling) => `${gross} ਕੁੱਲ - ${baling} ਬੇਲਿੰਗ @ ₹169/ਕੁਇੰਟਲ`,
    resSavingsLabel: 'ਮਿੱਟੀ ਦੇ ਪੋਸ਼ਕ ਤੱਤ + CAQM ਮੁਆਵਜ਼ਾ',
    savingsDetail: (nutrients, comp) => `${nutrients} ਪੋਸ਼ਕ ਤੱਤ + ਵੱਧ ਤੋਂ ਵੱਧ ${comp} ਮੁਆਵਜ਼ਾ`,

    // Machines
    machinesHeaderTitle: '🚜 ਨੇੜਲੀਆਂ ਪਰਾਲੀ ਪ੍ਰਬੰਧਨ ਮਸ਼ੀਨਾਂ',
    machinesAvailableBadge: '2 ਉਪਲਬਧ',
    dirbaChcName: 'ਦਿੜਬਾ ਕੋ-ਆਪਰੇਟਿਵ ਸੁਸਾਇਟੀ CHC',
    dirbaChcDesc: '3 ਹੈਪੀ ਸੀਡਰ • 2 ਸਟ੍ਰਾਅ ਬੇਲਰ ਉਪਲਬਧ',
    dirbaChcDist: '📍 ~4 ਕਿ.ਮੀ. ਫਲੈਗ ਕੀਤੇ ਜ਼ੋਨ ਤੋਂ 2.1 ਕਿ.ਮੀ.',
    reserveSlotBtn: '<span>🚜</span> ਮੁਫ਼ਤ ਮਸ਼ੀਨ ਸਲਾਟ ਬੁੱਕ ਕਰੋ',

    sunamChcName: 'ਸੁਨਾਮ ਐਗਰੋ ਮਸ਼ੀਨਰੀ ਹੱਬ',
    sunamChcDesc: '4 ਸੁਪਰ SMS • 1 ਜ਼ੀਰੋ-ਟਿਲ ਡਰਿੱਲ ਉਪਲਬਧ',
    sunamChcDist: '📍 ~4 ਕਿ.ਮੀ. ਫਲੈਗ ਕੀਤੇ ਜ਼ੋਨ ਤੋਂ 3.8 ਕਿ.ਮੀ.',

    // Buyers
    buyersHeaderTitle: '🏭 ਨੇੜਲੇ ਪਰਾਲੀ ਖਰੀਦਦਾਰ',
    buyersCountBadge: '3 ਖਰੀਦਦਾਰ',

    sangrurBuyerName: 'ਸੰਗਰੂਰ ਬਾਇਓ-CNG ਪਲਾਂਟ',
    sangrurBuyerDesc: 'ਗੱਠਾਂ ਬਣੀ ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਦੀ ਖਰੀਦ @ ₹180 / ਕੁਇੰਟਲ',
    sangrurBuyerDist: '📍 4.5 ਕਿ.ਮੀ. ਦੂਰ · ਪਿਕਅੱਪ ਉਪਲਬਧ',
    schedulePickupBtn: '<span>🚚</span> ਖੇਤ ਤੋਂ ਪਿਕਅੱਪ ਸ਼ਡਿਊਲ ਕਰੋ',

    barnalaBuyerName: 'ਬਰਨਾਲਾ ਬਾਇਓਮਾਸ ਪੈਲੇਟ ਯੂਨਿਟ',
    barnalaBuyerDesc: 'ਖੁੱਲ੍ਹੀ ਪਰਾਲੀ ਦੀ ਖਰੀਦ @ ₹140 / ਕੁਇੰਟਲ',
    barnalaBuyerDist: '📍 6.2 ਕਿ.ਮੀ. ਦੂਰ · ਖੁਦ ਡਿਲੀਵਰੀ',

    patialaBuyerName: 'ਪਟਿਆਲਾ ਪੇਪਰ ਮਿੱਲ ਕੋ-ਆਪ',
    patialaBuyerDesc: 'ਗੱਠਾਂ ਬਣੀ ਪਰਾਲੀ ਦੀ ਖਰੀਦ @ ₹160 / ਕੁਇੰਟਲ',
    patialaBuyerDist: '📍 12 ਕਿ.ਮੀ. ਦੂਰ · ਥੋਕ ਪਿਕਅੱਪ ਵੀਰਵਾਰ ਅਤੇ ਸ਼ਨੀਵਾਰ',

    // Helpline
    helplineText: '📞 ਮਦਦ ਚਾਹੀਦੀ ਹੈ? ਪਰਾਲੀ ਪ੍ਰਬੰਧਨ ਹੈਲਪਲਾਈਨ \'ਤੇ ਕਾਲ ਕਰੋ: <strong>1800-180-1551</strong> (ਟੋਲ ਫ੍ਰੀ)',

    // Confirmation Modals
    modalCloseAria: 'ਪੁਸ਼ਟੀਕਰਣ ਬੰਦ ਕਰੋ',
    modalDoneBtn: 'ਠੀਕ ਹੈ',
    modalLabel: 'ਸਟੇਜ-1 ਦਖਲਅੰਦਾਜ਼ੀ ਦੀ ਪੁਸ਼ਟੀ ਹੋ ਗਈ',

    machineModalTitle: 'ਮੁਫ਼ਤ ਮਸ਼ੀਨ ਸਲਾਟ ਬੁੱਕ ਹੋ ਗਿਆ',
    labelChc: 'ਕਸਟਮ ਹਾਇਰਿੰਗ ਸੈਂਟਰ',
    labelBookingToken: 'ਬੁਕਿੰਗ ਟੋਕਨ',
    labelReservedSlot: 'ਰਾਖਵਾਂ ਸਮਾਂ ਸਲਾਟ',
    labelServiceFee: 'ਸੇਵਾ ਫੀਸ',
    freeReservationVal: 'ਮੁਫ਼ਤ ਬੁਕਿੰਗ',
    machineModalNote: 'ਤੁਹਾਡਾ CHC ਇਹ ਸਲਾਟ ਰਾਖਵਾਂ ਰੱਖੇਗਾ ਜਦੋਂ ਤੱਕ ਫੀਲਡ ਟੀਮ ਮਸ਼ੀਨ ਡਿਲੀਵਰੀ ਦਾ ਪ੍ਰਬੰਧ ਕਰਦੀ ਹੈ।',
    machineToast: (centre) => `${centre}: ਮੁਫ਼ਤ ਮਸ਼ੀਨ ਸਲਾਟ ਬੁੱਕ ਹੋ ਗਿਆ।`,
    timeSlotDirba: 'ਅੱਜ · 10:00–12:00 IST',
    timeSlotSunam: 'ਅੱਜ · 14:00–16:00 IST',

    buyerModalTitle: 'ਖੇਤ ਤੋਂ ਪਿਕਅੱਪ ਸ਼ਡਿਊਲ ਹੋ ਗਿਆ',
    labelBuyer: 'ਪਰਾਲੀ ਖਰੀਦਦਾਰ',
    labelSelectedArea: 'ਚੁਣਿਆ ਗਿਆ ਰਕਬਾ',
    areaEstimatedNote: (ac, qtl) => `${ac} ਏਕੜ · ${qtl} ਕੁਇੰਟਲ ਅੰਦਾਜ਼ਨ`,
    labelConfirmedPayout: 'ਪੱਕਾ ਨਕਦ ਭੁਗਤਾਨ',
    payoutRateNote: (rate) => `@ ₹${rate}/ਕੁਇੰਟਲ`,
    labelPickupWindow: 'ਪਿਕਅੱਪ ਸਮਾਂ',
    buyerModalNote: 'ਪਰਾਲੀ ਨੂੰ ਖੇਤ ਦੇ ਗੇਟ ਨੇੜੇ ਪਹੁੰਚਯੋਗ ਰੱਖੋ। ਖਰੀਦਦਾਰ ਪਹੁੰਚਣ ਤੋਂ ਪਹਿਲਾਂ ਵਾਹਨ ਦੀ ਪੁਸ਼ਟੀ ਕਰੇਗਾ।',
    buyerToast: (buyer, payout) => `${buyer}: ${payout} ਲਈ ਪਿਕਅੱਪ ਸ਼ਡਿਊਲ ਹੋ ਗਿਆ।`,
    timeSlotSangrur: 'ਕੱਲ੍ਹ · 08:00–11:00 IST',
    timeSlotBarnala: 'ਕੱਲ੍ਹ · 11:30–14:30 IST',
    timeSlotPatiala: 'ਵੀਰਵਾਰ · 09:00–12:00 IST'
  },
  hi: {
    portalTab: '🌾 किसान अलर्ट पेज',
    badge: '🟢 लाइव स्टेज-1 आग लगने से पूर्व हस्तक्षेप · सेंटिनल-2 कटाई NDVI गिरावट द्वारा सक्रिय (जलाने से 72 घंटे पहले)',
    title: '🌾 सरल किसान अलर्ट पेज',
    desc: 'निकटवर्ती मशीन या फसल अवशेष खरीदार विकल्प ताकि आग लगाने से पहले किसानों को व्यावहारिक सहायता मिल सके।',
    calcKicker: 'स्टेज-1 निर्णय सहायता',
    calcTitle: 'पराली नकद भुगतान बनाम जलाने की लागत कैलकुलेटर',
    calcDesc: 'जलाने की अवधि से पहले अवशेष संग्रह का मूल्य देखने के लिए अपना कटाई वाला रकबा चुनें।',
    acresUnit: 'एकड़',
    scaleMin: '1 एकड़',
    scaleMax: '50 एकड़',
    resStrawLabel: 'अनुमानित पराली',
    resStrawSub: '17 क्विंटल प्रति एकड़ (रिपोर्टेड 15-19.5)',
    qtlUnit: 'क्विंटल',
    resCashLabel: 'पराली बेचने से शुद्ध मूल्य (अनुमानित)',
    resCashSub: (gross, baling) => `${gross} कुल - ${baling} बेलिंग @ ₹169/क्विंटल`,
    resSavingsLabel: 'मिट्टी के पोषक तत्व + CAQM मुआवज़ा',
    savingsDetail: (nutrients, comp) => `${nutrients} पोषक तत्व + अधिकतम ${comp} मुआवज़ा`,

    // Machines
    machinesHeaderTitle: '🚜 निकटवर्ती पराली प्रबंधन मशीनें',
    machinesAvailableBadge: '2 उपलब्ध',
    dirbaChcName: 'दिड़बा कोऑपरेटिव सोसाइटी CHC',
    dirbaChcDesc: '3 हैप्पी सीडर • 2 स्ट्रॉ बेलर उपलब्ध',
    dirbaChcDist: '📍 ~4 किमी फ्लैग किए गए ज़ोन से 2.1 किमी',
    reserveSlotBtn: '<span>🚜</span> निःशुल्क मशीन स्लॉट बुक करें',

    sunamChcName: 'सुनाम एग्रो मशीनरी हब',
    sunamChcDesc: '4 सुपर SMS • 1 ज़ीरो-टिल ड्रिल उपलब्ध',
    sunamChcDist: '📍 ~4 किमी फ्लैग किए गए ज़ोन से 3.8 किमी',

    // Buyers
    buyersHeaderTitle: '🏭 निकटवर्ती फसल अवशेष खरीदार',
    buyersCountBadge: '3 खरीदार',

    sangrurBuyerName: 'संगरूर बायो-CNG प्लांट',
    sangrurBuyerDesc: 'गांठ बंधी धान की पराली की खरीद @ ₹180 / क्विंटल',
    sangrurBuyerDist: '📍 4.5 किमी दूर · पिकअप उपलब्ध',
    schedulePickupBtn: '<span>🚚</span> खेत से पिकअप शेड्यूल करें',

    barnalaBuyerName: 'बरनाला बायोमास पेलेट यूनिट',
    barnalaBuyerDesc: 'खुली पराली की खरीद @ ₹140 / क्विंटल',
    barnalaBuyerDist: '📍 6.2 किमी दूर · स्वयं डिलीवरी',

    patialaBuyerName: 'पटियाला पेपर मिल को-ऑप',
    patialaBuyerDesc: 'गांठ बंधी पराली की खरीद @ ₹160 / क्विंटल',
    patialaBuyerDist: '📍 12 किमी दूर · थोक पिकअप गुरुवार और शनिवार',

    // Helpline
    helplineText: '📞 सहायता चाहिए? फसल अवशेष प्रबंधन हेल्पलाइन पर कॉल करें: <strong>1800-180-1551</strong> (टोल फ्री)',

    // Confirmation Modals
    modalCloseAria: 'पुष्टि बंद करें',
    modalDoneBtn: 'संपन्न',
    modalLabel: 'स्टेज-1 हस्तक्षेप की पुष्टि हो गई',

    machineModalTitle: 'निःशुल्क मशीन स्लॉट बुक हो गया',
    labelChc: 'कस्टम हायरिंग सेंटर',
    labelBookingToken: 'बुकिंग टोकन',
    labelReservedSlot: 'आरक्षित समय स्लॉट',
    labelServiceFee: 'सेवा शुल्क',
    freeReservationVal: 'निःशुल्क बुकिंग',
    machineModalNote: 'आपकी CHC इस स्लॉट को सुरक्षित रखेगी जब तक फील्ड टीम मशीन डिलीवरी का समन्वय करती है।',
    machineToast: (centre) => `${centre}: निःशुल्क मशीन स्लॉट बुक हो गया।`,
    timeSlotDirba: 'आज · 10:00–12:00 IST',
    timeSlotSunam: 'आज · 14:00–16:00 IST',

    buyerModalTitle: 'खेत से पिकअप शेड्यूल हो गया',
    labelBuyer: 'पराली खरीदार',
    labelSelectedArea: 'चयनित रकबा',
    areaEstimatedNote: (ac, qtl) => `${ac} एकड़ · ${qtl} क्विंटल अनुमानित`,
    labelConfirmedPayout: 'पुष्टि की गई नकद राशि',
    payoutRateNote: (rate) => `@ ₹${rate}/क्विंटल`,
    labelPickupWindow: 'पिकअप समय',
    buyerModalNote: 'अवशेष को खेत के गेट के पास सुलभ रखें। खरीदार पहुंचने से पहले वाहन की पुष्टि करेगा।',
    buyerToast: (buyer, payout) => `${buyer}: ${payout} के लिए पिकअप शेड्यूल हो गया।`,
    timeSlotSangrur: 'कल · 08:00–11:00 IST',
    timeSlotBarnala: 'कल · 11:30–14:30 IST',
    timeSlotPatiala: 'गुरुवार · 09:00–12:00 IST'
  }
};

function updatePayoutCalculator(value) {
  selectedAcreage = Number(value);
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  const straw = selectedAcreage * CALC.STRAW_QTL_PER_ACRE;
  const gross = straw * CALC.PLANT_RATE_PER_QTL;
  const baling = straw * CALC.BALING_COST_PER_QTL;
  const net = Math.max(0, gross - baling);
  const nutrients = straw * CALC.NUTRIENT_VALUE_PER_QTL;
  const comp = compensation(selectedAcreage);

  const acreageEl = document.getElementById('acreageValue');
  if (acreageEl) acreageEl.textContent = selectedAcreage;

  const strawEl = document.getElementById('strawValue');
  if (strawEl) strawEl.textContent = `${straw.toLocaleString('en-IN')} ${copy.qtlUnit}`;

  const cashEl = document.getElementById('cashPayoutValue');
  if (cashEl) cashEl.textContent = formatRupees(net);

  const cashSubEl = document.getElementById('resCashSub');
  if (cashSubEl) cashSubEl.textContent = copy.resCashSub(formatRupees(gross), formatRupees(baling));

  const savingsEl = document.getElementById('savingsValue');
  if (savingsEl) savingsEl.textContent = formatRupees(nutrients + comp);

  const detailEl = document.getElementById('savingsDetail');
  if (detailEl) detailEl.textContent = copy.savingsDetail(formatRupees(nutrients), formatRupees(comp));
}

function farmerConfirmation(title, content) {
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  document.getElementById('farmerConfirmationModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'farmerConfirmationModal';
  modal.className = 'farmer-confirmation-modal';
  modal.innerHTML = `<div class="farmer-confirmation-card" role="dialog" aria-modal="true" aria-label="${title}">
    <button class="farmer-modal-close" onclick="closeFarmerConfirmation()" aria-label="${copy.modalCloseAria}">×</button>
    <div class="confirmation-icon">✓</div>
    <span class="confirmation-label">${copy.modalLabel}</span>
    <h3>${title}</h3>
    ${content}
    <button class="action-btn green-btn" onclick="closeFarmerConfirmation()">${copy.modalDoneBtn}</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.farmer-modal-close').focus();
}

function closeFarmerConfirmation() {
  document.getElementById('farmerConfirmationModal')?.remove();
}

function reserveMachineSlot(centre, timeSlot) {
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  farmerConfirmation(copy.machineModalTitle, `<div class="confirmation-details"><div><span>${copy.labelChc}</span><strong>${centre}</strong></div><div><span>${copy.labelBookingToken}</span><strong>#CHC-8841</strong></div><div><span>${copy.labelReservedSlot}</span><strong>${timeSlot}</strong></div><div><span>${copy.labelServiceFee}</span><strong class="confirmation-good">${copy.freeReservationVal}</strong></div></div><p>${copy.machineModalNote}</p>`);
  showToast(copy.machineToast(centre), 'success');
}

function scheduleFarmGatePickup(buyer, rate, timeSlot) {
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  const straw = selectedAcreage * STRAW_PER_ACRE;
  const payout = straw * rate;
  farmerConfirmation(copy.buyerModalTitle, `<div class="confirmation-details"><div><span>${copy.labelBuyer}</span><strong>${buyer}</strong></div><div><span>${copy.labelSelectedArea}</span><strong>${copy.areaEstimatedNote(selectedAcreage, straw)}</strong></div><div><span>${copy.labelConfirmedPayout}</span><strong class="confirmation-good">${formatRupees(payout)} ${copy.payoutRateNote(rate)}</strong></div><div><span>${copy.labelPickupWindow}</span><strong>${timeSlot}</strong></div></div><p>${copy.buyerModalNote}</p>`);
  showToast(copy.buyerToast(buyer, formatRupees(payout)), 'success');
}

function handleReserveMachine(machineKey) {
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  let centre = copy.dirbaChcName;
  let timeSlot = copy.timeSlotDirba;
  if (machineKey === 'sunam') {
    centre = copy.sunamChcName;
    timeSlot = copy.timeSlotSunam;
  }
  reserveMachineSlot(centre, timeSlot);
}

function handleSchedulePickup(buyerKey) {
  const copy = farmerTranslations[currentFarmerLanguage] || farmerTranslations.en;
  let buyer = copy.sangrurBuyerName;
  let rate = 180;
  let timeSlot = copy.timeSlotSangrur;
  if (buyerKey === 'barnala') {
    buyer = copy.barnalaBuyerName;
    rate = 140;
    timeSlot = copy.timeSlotBarnala;
  } else if (buyerKey === 'patiala') {
    buyer = copy.patialaBuyerName;
    rate = 160;
    timeSlot = copy.timeSlotPatiala;
  }
  scheduleFarmGatePickup(buyer, rate, timeSlot);
}

function setLanguage(language) {
  if (!['en', 'pa', 'hi'].includes(language)) language = 'en';
  currentFarmerLanguage = language;
  try {
    localStorage.setItem('agnidrishti_farmer_lang', language);
  } catch (e) {}

  const copy = farmerTranslations[language] || farmerTranslations.en;

  // Update button active state
  ['en', 'pa', 'hi'].forEach(code => {
    const btn = document.getElementById(`lang-${code}`);
    if (btn) {
      const active = code === language;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    }
  });

  // Navigation tab
  const tabFarmer = document.getElementById('tabFarmer');
  if (tabFarmer) tabFarmer.innerHTML = `<span>🌾</span> ${copy.portalTab.replace('🌾 ', '')}`;

  // Helper setters
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  // Banner
  setText('farmerBadge', copy.badge);
  setText('farmerTitle', copy.title);
  setText('farmerDesc', copy.desc);

  // Calculator
  setText('payoutKicker', copy.calcKicker);
  setText('payoutCalculatorTitle', copy.calcTitle);
  setText('payoutDesc', copy.calcDesc);
  setText('acreageUnit', copy.acresUnit);
  setText('scaleMin', copy.scaleMin);
  setText('scaleMax', copy.scaleMax);
  setText('resStrawLabel', copy.resStrawLabel);
  setText('resStrawSub', copy.resStrawSub);
  setText('resCashLabel', copy.resCashLabel);
  setText('resSavingsLabel', copy.resSavingsLabel);

  // Machines
  setText('machinesHeaderTitle', copy.machinesHeaderTitle);
  setText('machinesAvailableBadge', copy.machinesAvailableBadge);
  setText('dirbaChcName', copy.dirbaChcName);
  setText('dirbaChcDesc', copy.dirbaChcDesc);
  setText('dirbaChcDist', copy.dirbaChcDist);
  setHtml('dirbaReserveBtn', copy.reserveSlotBtn);

  setText('sunamChcName', copy.sunamChcName);
  setText('sunamChcDesc', copy.sunamChcDesc);
  setText('sunamChcDist', copy.sunamChcDist);
  setHtml('sunamReserveBtn', copy.reserveSlotBtn);

  // Buyers
  setText('buyersHeaderTitle', copy.buyersHeaderTitle);
  setText('buyersCountBadge', copy.buyersCountBadge);
  setText('sangrurBuyerName', copy.sangrurBuyerName);
  setText('sangrurBuyerDesc', copy.sangrurBuyerDesc);
  setText('sangrurBuyerDist', copy.sangrurBuyerDist);
  setHtml('sangrurPickupBtn', copy.schedulePickupBtn);

  setText('barnalaBuyerName', copy.barnalaBuyerName);
  setText('barnalaBuyerDesc', copy.barnalaBuyerDesc);
  setText('barnalaBuyerDist', copy.barnalaBuyerDist);
  setHtml('barnalaPickupBtn', copy.schedulePickupBtn);

  setText('patialaBuyerName', copy.patialaBuyerName);
  setText('patialaBuyerDesc', copy.patialaBuyerDesc);
  setText('patialaBuyerDist', copy.patialaBuyerDist);
  setHtml('patialaPickupBtn', copy.schedulePickupBtn);

  // Helpline
  setHtml('farmerHelplineText', copy.helplineText);

  // Re-calculate dynamic values with current language unit
  updatePayoutCalculator(selectedAcreage);
}

// Backward-compatibility alias
window.setAlertLanguage = setLanguage;

// Initialize language and calculator
setLanguage(currentFarmerLanguage);

// Check if initial hash requested farmer portal
if (window.location.hash === '#farmer' || window.location.hash === '#farmerPortal') {
  switchPortal('farmer');
}
