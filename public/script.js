// AgniDrishti officer map: self-contained evidence prototypes (Vanilla JS + Leaflet)
const map = L.map('map', { zoomControl: false }).setView([30.12, 75.91], 10);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri | AgniDrishti (INSAT-3DS + Sentinel-2)' }).addTo(map);
const eveningLayerGroup = L.layerGroup().addTo(map);
let activeCaseIndex = 0, sidebarOpen = true;
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
function updateStatusCounters(mode='evening') { const counts=mode==='midday'?[0,0,0,0]:[2,1,1,1]; ['statConfirmed','statFalseAlarm','statCaughtLate','statHaze'].forEach((id,i)=>document.getElementById(id).textContent=counts[i]); }

function renderMapLayers() { eveningLayerGroup.clearLayers(); casesData.forEach((item,index)=>{ if(item.zoneBounds){const rect=L.rectangle(item.zoneBounds,{color:'#f97316',weight:2,dashArray:'6, 6',fillColor:'#f97316',fillOpacity:.15}).addTo(eveningLayerGroup);rect.bindTooltip(`<b>INSAT-3DS ~4 km tripwire</b><br>${item.village}<br>${item.insatSpike}<br><i>Click to inspect evidence</i>`,{className:'custom-tooltip'});rect.on('click',()=>selectCase(index));} const poly=L.polygon(item.fieldPoly,{color:'#fff',weight:2,fillColor:item.polyColor,fillOpacity:.85}).addTo(eveningLayerGroup);poly.bindTooltip(`<b>${item.id}: ${item.ruleDecision}</b><br>Click to view evidence pack`,{className:'custom-tooltip'});poly.on('click',()=>selectCase(index)); }); }

function thermalReadings(c) { const peakIndex=c.peakTime?Number(c.peakTime.slice(0,2))*2+Number(c.peakTime.slice(3))/30:-1; return Array.from({length:48},(_,i)=>{const daylight=Math.max(0,Math.sin(((i/2-5.5)/13)*Math.PI));let value=286+daylight*20+(i%3-1)*.7;if(peakIndex>=0){const d=Math.abs(i-peakIndex);if(d===0)value=c.peakK;else if(d===1)value+=(c.peakK-value)*.38;else if(d===2)value+=(c.peakK-value)*.12;}return Number(value.toFixed(1));}); }
function thermalChart(c) { const values=thermalReadings(c), w=356,h=154,p={l:30,r:8,t:14,b:24},min=275,max=360,x=i=>p.l+i*(w-p.l-p.r)/47,y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min),points=values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '),viirs=27,peak=c.peakTime?Number(c.peakTime.slice(0,2))*2+Number(c.peakTime.slice(3))/30:-1; const grid=[280,320,360].map(v=>`<line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" class="thermal-grid"/><text x="2" y="${y(v)+3}" class="thermal-axis">${v}</text>`).join('');const marker=peak>=0?`<circle cx="${x(peak)}" cy="${y(values[peak])}" r="4" class="thermal-peak"/><text x="${Math.min(x(peak)+6,270)}" y="${Math.max(y(values[peak])-8,13)}" class="thermal-annotation">${c.peakTime} • ${c.peakK} K</text>`:`<text x="156" y="31" class="thermal-annotation thermal-calm">No &gt;330 K tripwire spike</text>`; return `<section class="thermal-panel" aria-label="24 hour INSAT-3DS thermal chart"><div class="evidence-section-head"><span>24-hour INSAT-3DS thermal trace</span><small>3.9 µm MIR · 30 min scans</small></div><svg class="thermal-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Thermal trace from 00:00 to 23:30 IST">${grid}<line x1="${x(viirs)}" y1="${p.t}" x2="${x(viirs)}" y2="${h-p.b}" class="viirs-line"/><polyline points="${points}" class="thermal-line"/>${marker}<text x="${x(viirs)-30}" y="${h-5}" class="viirs-label">13:30 VIIRS (missed)</text><text x="${p.l}" y="${h-5}" class="thermal-axis">00:00</text><text x="${w-39}" y="${h-5}" class="thermal-axis">23:30</text></svg><div class="thermal-summary"><span class="viirs-key">Dashed: 13:30 IST VIIRS pass ${c.viirsK} K</span><span>${c.peakTime?`Peak: ${c.peakTime} IST @ ${c.peakK} K`:'Late scar found on next clear Sentinel-2 pass'}</span></div></section>`; }

function splitSlider(c) { const active=smogPenetrationCases.has(c.id), post=c.afterType==='haze'?(active?'SWIR / SAR alternate evidence':'Post-pass optical blocked by smog'):c.afterType==='industrial'?'Post-pass: no crop scar':'Post-pass Sentinel-2 10 m SWIR burn scar'; return `<section class="split-section"><div class="evidence-section-head"><span>Before / after burn-scar comparison</span><small>Drag to compare</small></div><div class="split-comparison ${c.afterType}" id="split-${c.id}" style="--split:50%"><div class="scene scene-before"><span>Pre-pass · Golden Stubble</span><i></i><i></i><i></i></div><div class="scene scene-after"><span>${post}</span><i></i><i></i><i></i></div><div class="split-divider"><b>↔</b></div></div><input class="split-range" aria-label="Adjust before and after comparison" type="range" min="0" max="100" value="50" oninput="setEvidenceSplit('${c.id}',this.value)"><div class="split-meta"><span>${c.khasra} · ${c.acreage}</span><span>dNBR ${c.dnbr}</span><span>NDVI ${c.ndvi}</span></div>${c.afterType==='haze'?`<button class="smog-toggle ${active?'active':''}" onclick="toggleSmogPenetration('${c.id}')">${active?'✓ SWIR 2190 nm / Sentinel-1 SAR Penetration Active':'Activate SWIR 2190nm / Sentinel-1 SAR Smog Penetration'}</button>`:''}</section>`; }

function renderEvidencePack(index) { activeCaseIndex=index; const c=casesData[index], dispatched=dispatchedCases.has(c.id), container=document.getElementById('evidenceContainer'); const list=casesData.map((item,idx)=>`<button class="case-list-item ${idx===index?'active-case':''}" onclick="selectCase(${idx})" aria-label="Select ${item.id}"><span><strong>${item.id}</strong><small>${item.village}</small></span><span class="decision-badge ${item.badgeClass}">${item.stateIcon} ${item.ruleDecision}</span></button>`).join(''); container.innerHTML=`<div class="evidence-card deep-evidence-card"><div class="card-top"><div><span class="case-id">${c.id}</span><h3>${c.village}</h3><p>${c.khasra} · ${c.acreage}</p></div><span class="decision-badge ${c.badgeClass}">${c.stateIcon} ${c.ruleDecision}</span></div><div class="signal-strip"><div><span>INSAT-3DS tripwire</span><strong>${c.insatSpike}</strong></div><div><span>Sentinel-2 plot check</span><strong>${c.sentinelScar}</strong></div></div>${thermalChart(c)}${splitSlider(c)}<div class="verification-strip"><span>🛡️ No automatic penalties</span><strong>${dispatched?'● Nodal officer dispatched':c.status}</strong></div><div class="btn-row evidence-actions"><button class="action-btn green-btn ${dispatched?'dispatched':''}" onclick="toggleDispatch(${index})">${dispatched?'✓ Nodal Officer Dispatched — Recall':'Dispatch Nodal Officer'}</button><button class="action-btn blue-btn" onclick="openDossier(${index})">Export Official Evidence Dossier</button></div></div><div class="case-list-wrap"><div class="case-list-header">Evidence cases · ${casesData.length}</div>${list}</div>`; }
function setEvidenceSplit(id,value){const split=document.getElementById(`split-${id}`);if(split)split.style.setProperty('--split',`${value}%`)}
function toggleSmogPenetration(id){smogPenetrationCases.has(id)?smogPenetrationCases.delete(id):smogPenetrationCases.add(id);renderEvidencePack(activeCaseIndex);showToast(smogPenetrationCases.has(id)?'SWIR 2190 nm and Sentinel-1 SAR review activated.':'Alternate smog penetration review paused.','success')}
function toggleDispatch(index){const c=casesData[index];dispatchedCases.has(c.id)?dispatchedCases.delete(c.id):dispatchedCases.add(c.id);renderEvidencePack(index);showToast(dispatchedCases.has(c.id)?`${c.id}: Nodal officer dispatched with evidence pack.`:`${c.id}: Officer dispatch recalled.`,dispatchedCases.has(c.id)?'success':'info')}

function qrSvg(id){let seed=[...id].reduce((n,char)=>n+char.charCodeAt(0),0),cells='';for(let row=0;row<21;row++)for(let col=0;col<21;col++){const finder=(row<7&&col<7)||(row<7&&col>13)||(row>13&&col<7),value=finder?((row%6===0||col%6===0||(row>1&&row<5&&col>1&&col<5))?1:0):((seed+row*13+col*7+row*col)%5<2?1:0);if(value)cells+=`<rect x="${col}" y="${row}" width="1" height="1"/>`}return `<svg class="qr-code" viewBox="0 0 21 21" aria-label="QR verification code">${cells}</svg>`}
function openDossier(index){const c=casesData[index];document.getElementById('dossierModal')?.remove();const modal=document.createElement('div');modal.id='dossierModal';modal.className='dossier-modal';modal.innerHTML=`<div class="dossier-sheet" role="dialog" aria-modal="true" aria-label="Official evidence dossier"><button class="modal-close no-print" onclick="closeDossier()" aria-label="Close dossier">×</button><header><div><p>AGNI DRISHTI · OFFICER EVIDENCE DOSSIER</p><h2>${c.id}</h2><span>${c.ruleDecision} evidence — human verification required</span></div>${qrSvg(c.id)}</header><section><h3>Plot identification</h3><dl><div><dt>Location</dt><dd>${c.village}</dd></div><div><dt>Khasra / grid</dt><dd>${c.khasra}</dd></div><div><dt>Area</dt><dd>${c.acreage}</dd></div><div><dt>Coordinates</dt><dd>${c.coords[0]}, ${c.coords[1]}</dd></div></dl></section><section><h3>Satellite pass metadata</h3><dl><div><dt>INSAT-3DS</dt><dd>${c.insatSpike}</dd></div><div><dt>VIIRS pass</dt><dd>13:30 IST · ${c.viirsK} K · missed late event</dd></div><div><dt>Sentinel-2 10 m</dt><dd>${c.sentinelScar}</dd></div><div><dt>Change indicators</dt><dd>dNBR ${c.dnbr} · NDVI ${c.ndvi}</dd></div></dl></section><aside class="dossier-note">Verification QR: ${c.id}-INSAT3DS-S2 · This dossier supports field verification and does not authorize an automatic penalty.</aside><footer><span>Generated local evidence prototype · 30-min thermal fusion</span><button class="action-btn green-btn no-print" onclick="window.print()">Print dossier</button></footer></div>`;document.body.appendChild(modal);modal.querySelector('.modal-close').focus()}
function closeDossier(){document.getElementById('dossierModal')?.remove()}

function selectCase(index){activeCaseIndex=index;map.flyTo(casesData[index].coords,13,{duration:.7});renderEvidencePack(index)}
function setObservationMode(mode){const midday=mode==='midday';document.getElementById('btnMidday').classList.toggle('active',midday);document.getElementById('btnEvening').classList.toggle('active',!midday);document.getElementById('btnMidday').setAttribute('aria-selected',midday);document.getElementById('btnEvening').setAttribute('aria-selected',!midday);document.getElementById('modeBanner').innerHTML=midday?'⚠️ <strong>Midday Pass (VIIRS):</strong> 13:30 IST snapshot misses most late-afternoon burns.':'⚡ <strong>Active Watch:</strong> INSAT-3DS thermal scans every 30 minutes + Sentinel-2 10 m field check';midday?map.removeLayer(eveningLayerGroup):eveningLayerGroup.addTo(map);updateStatusCounters(mode)}
function switchPortal(portal){const officer=portal==='officer';document.getElementById('officerPortal').classList.toggle('hidden',!officer);document.getElementById('farmerPortal').classList.toggle('hidden',officer);document.getElementById('tabOfficer').classList.toggle('active-tab',officer);document.getElementById('tabFarmer').classList.toggle('active-tab',!officer);document.getElementById('tabOfficer').setAttribute('aria-selected',officer);document.getElementById('tabFarmer').setAttribute('aria-selected',!officer);if(officer)setTimeout(()=>map.invalidateSize(),100)}
function toggleSidebar(){sidebarOpen=!sidebarOpen;document.getElementById('officerPortal').classList.toggle('sidebar-collapsed',!sidebarOpen);document.getElementById('toggleIcon').textContent=sidebarOpen?'◀':'▶';setTimeout(()=>map.invalidateSize(),300)}
function bookOption(optionName){showToast(`Request sent for: ${optionName}`,'success')}

updateStatusCounters();renderMapLayers();renderEvidencePack(0);

// Stage-1 farmer intervention state. These flows stay usable without an API connection.
let selectedAcreage = 5;
const STRAW_PER_ACRE = 22;
const BIO_CNG_RATE = 180;
const SOIL_NITROGEN_SAVING_PER_ACRE = 1000;
const POTENTIAL_NGT_FINE_PER_ACRE = 2500;

function formatRupees(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function updatePayoutCalculator(value) {
  selectedAcreage = Number(value);
  const straw = selectedAcreage * STRAW_PER_ACRE;
  const cash = straw * BIO_CNG_RATE;
  const soilSaving = selectedAcreage * SOIL_NITROGEN_SAVING_PER_ACRE;
  const fineAvoided = selectedAcreage * POTENTIAL_NGT_FINE_PER_ACRE;
  document.getElementById('acreageValue').textContent = selectedAcreage;
  document.getElementById('strawValue').textContent = `${straw.toLocaleString('en-IN')} qtl`;
  document.getElementById('cashPayoutValue').textContent = formatRupees(cash);
  document.getElementById('savingsValue').textContent = formatRupees(soilSaving + fineAvoided);
  document.getElementById('savingsDetail').textContent = `${formatRupees(soilSaving)} soil nutrients + ${formatRupees(fineAvoided)} potential fine avoided`;
}

function farmerConfirmation(title, content) {
  document.getElementById('farmerConfirmationModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'farmerConfirmationModal';
  modal.className = 'farmer-confirmation-modal';
  modal.innerHTML = `<div class="farmer-confirmation-card" role="dialog" aria-modal="true" aria-label="${title}">
    <button class="farmer-modal-close" onclick="closeFarmerConfirmation()" aria-label="Close confirmation">×</button>
    <div class="confirmation-icon">✓</div>
    <span class="confirmation-label">Stage-1 intervention confirmed</span>
    <h3>${title}</h3>
    ${content}
    <button class="action-btn green-btn" onclick="closeFarmerConfirmation()">Done</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.farmer-modal-close').focus();
}

function closeFarmerConfirmation() {
  document.getElementById('farmerConfirmationModal')?.remove();
}

function reserveMachineSlot(centre, timeSlot) {
  farmerConfirmation('Free machine slot reserved', `<div class="confirmation-details"><div><span>Custom Hiring Centre</span><strong>${centre}</strong></div><div><span>Booking token</span><strong>#CHC-8841</strong></div><div><span>Reserved time slot</span><strong>${timeSlot}</strong></div><div><span>Service fee</span><strong class="confirmation-good">Free reservation</strong></div></div><p>Your CHC will hold this slot while the field team coordinates machine delivery.</p>`);
  showToast(`${centre}: free machine slot reserved.`, 'success');
}

function scheduleFarmGatePickup(buyer, rate, timeSlot) {
  const straw = selectedAcreage * STRAW_PER_ACRE;
  const payout = straw * rate;
  farmerConfirmation('Farm-gate pickup scheduled', `<div class="confirmation-details"><div><span>Residue buyer</span><strong>${buyer}</strong></div><div><span>Selected area</span><strong>${selectedAcreage} acres · ${straw} qtl estimated</strong></div><div><span>Confirmed cash payout</span><strong class="confirmation-good">${formatRupees(payout)} @ ₹${rate}/qtl</strong></div><div><span>Pickup window</span><strong>${timeSlot}</strong></div></div><p>Keep the residue accessible at the farm gate. The buyer will confirm the vehicle before arrival.</p>`);
  showToast(`${buyer}: pickup scheduled for ${formatRupees(payout)}.`, 'success');
}

// Calculator markup is in the farmer portal; initialize it after the document has loaded.
updatePayoutCalculator(selectedAcreage);

// Multilingual WhatsApp / IVR preview for the 72-hour, pre-burn intervention.
let alertLanguage = 'en';
let alertReply = null;
const farmerAlertCopy = {
  en: {
    status: 'WhatsApp · automated alert',
    intro: 'Hello, Dirba farmer 👋 Sentinel-2 has detected a harvest NDVI drop on your field (0.62 → 0.18). Your paddy harvest is complete and the next 72 hours are ideal for residue management — before any burn window.',
    prompt: 'Choose a free, nearby option:',
    machine: '[1] 🚜 Book Happy Seeder @ Dirba Co-op (2.1 km)',
    buyer: '[2] 💰 Sell 110 Qtl Straw for ₹19,800 @ Sangrur Bio-CNG',
    machineConfirm: '✅ Happy Seeder request confirmed with Dirba Co-op (2.1 km). Your free machine-slot card is highlighted below.',
    buyerConfirm: '✅ Sangrur Bio-CNG pickup interest confirmed for 110 qtl / ₹19,800. Your payout card is highlighted below.'
  },
  pa: {
    status: 'ਵਟਸਐਪ · ਆਟੋਮੈਟਿਕ ਅਲਰਟ',
    intro: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਦਿੜਬਾ ਕਿਸਾਨ ਜੀ 👋 ਸੈਂਟੀਨਲ-2 ਨੇ ਤੁਹਾਡੇ ਖੇਤ ਵਿੱਚ ਕਟਾਈ ਤੋਂ ਬਾਅਦ NDVI ਘਟਾਅ (0.62 → 0.18) ਪਾਇਆ ਹੈ। ਅਗਲੇ 72 ਘੰਟੇ ਪਰਾਲੀ ਪ੍ਰਬੰਧਨ ਲਈ ਢੁੱਕਵੇਂ ਹਨ — ਸਾੜਨ ਤੋਂ ਪਹਿਲਾਂ।',
    prompt: 'ਨੇੜੇ ਦੀ ਮੁਫ਼ਤ ਸਹੂਲਤ ਚੁਣੋ:',
    machine: '[1] 🚜 ਦਿੜਬਾ ਕੋ-ਆਪ ਤੋਂ ਹੈਪੀ ਸੀਡਰ ਬੁੱਕ ਕਰੋ (2.1 ਕਿ.ਮੀ.)',
    buyer: '[2] 💰 ਸੰਗਰੂਰ ਬਾਇਓ-CNG ਨੂੰ 110 ਕੁਇੰਟਲ ਪਰਾਲੀ ₹19,800 ਵਿੱਚ ਵੇਚੋ',
    machineConfirm: '✅ ਦਿੜਬਾ ਕੋ-ਆਪ (2.1 ਕਿ.ਮੀ.) ਕੋਲ ਹੈਪੀ ਸੀਡਰ ਦੀ ਬੇਨਤੀ ਪੱਕੀ ਹੋ ਗਈ ਹੈ। ਹੇਠਾਂ ਮਸ਼ੀਨ ਕਾਰਡ ਹਾਈਲਾਈਟ ਹੈ।',
    buyerConfirm: '✅ 110 ਕੁਇੰਟਲ / ₹19,800 ਲਈ ਸੰਗਰੂਰ ਬਾਇਓ-CNG ਪਿਕਅੱਪ ਦਿਲਚਸਪੀ ਪੱਕੀ ਹੈ। ਹੇਠਾਂ ਭੁਗਤਾਨ ਕਾਰਡ ਹਾਈਲਾਈਟ ਹੈ।'
  },
  hi: {
    status: 'व्हाट्सऐप · स्वचालित अलर्ट',
    intro: 'नमस्ते, दिड़बा किसान जी 👋 सेंटिनल-2 ने आपके खेत में कटाई के बाद NDVI गिरावट (0.62 → 0.18) देखी है। अगले 72 घंटे पराली प्रबंधन के लिए उपयुक्त हैं — जलाने से पहले।',
    prompt: 'पास का निःशुल्क विकल्प चुनें:',
    machine: '[1] 🚜 दिड़बा को-ऑप से हैप्पी सीडर बुक करें (2.1 किमी)',
    buyer: '[2] 💰 110 क्विंटल पराली ₹19,800 में संग्रूर बायो-CNG को बेचें',
    machineConfirm: '✅ दिड़बा को-ऑप (2.1 किमी) के साथ हैप्पी सीडर अनुरोध पक्का हो गया है। नीचे मशीन कार्ड हाइलाइट किया गया है।',
    buyerConfirm: '✅ 110 क्विंटल / ₹19,800 के लिए संग्रूर बायो-CNG पिकअप रुचि पक्की है। नीचे भुगतान कार्ड हाइलाइट किया गया है।'
  }
};

function renderAlertPreview() {
  const copy = farmerAlertCopy[alertLanguage];
  const chat = document.getElementById('whatsappChat');
  if (!chat) return;
  document.getElementById('whatsappStatus').textContent = copy.status;
  chat.innerHTML = `<div class="chat-timestamp">Just now · Sentinel-2 harvest alert</div>
    <div class="chat-bubble incoming">${copy.intro}</div>
    <div class="chat-bubble incoming">${copy.prompt}</div>
    <div class="quick-replies">
      <button class="quick-reply" onclick="chooseAlertReply('machine')">${copy.machine}</button>
      <button class="quick-reply" onclick="chooseAlertReply('buyer')">${copy.buyer}</button>
    </div>
    ${alertReply ? `<div class="chat-bubble outgoing">${alertReply === 'machine' ? copy.machine : copy.buyer}</div><div class="chat-bubble incoming confirmation-bubble">${alertReply === 'machine' ? copy.machineConfirm : copy.buyerConfirm}</div>` : ''}`;
  if (alertReply) chat.scrollTop = chat.scrollHeight;
}

function setAlertLanguage(language) {
  alertLanguage = language;
  ['en', 'pa', 'hi'].forEach(code => {
    const button = document.getElementById(`lang-${code}`);
    const active = code === language;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active);
  });
  renderAlertPreview();
}

function highlightFarmerOption(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  document.querySelectorAll('.option-item.alert-match').forEach(item => item.classList.remove('alert-match'));
  card.classList.add('alert-match');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => card.classList.remove('alert-match'), 4200);
}

function chooseAlertReply(reply) {
  alertReply = reply;
  renderAlertPreview();
  highlightFarmerOption(reply === 'machine' ? 'dirbaChcCard' : 'sangrurBuyerCard');
  showToast(reply === 'machine' ? 'Dirba Happy Seeder request selected.' : 'Sangrur Bio-CNG sale option selected.', 'success');
}

renderAlertPreview();
