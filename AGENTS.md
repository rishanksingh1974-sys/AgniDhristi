# AGENTS.md — AgniDrishti Master Context & Guardrails for Codex

## 1. STRICT CODING GUARDRAILS (READ FIRST)
- **Preserve Existing UI & Theme:** Do NOT delete or break the existing header, Leaflet/map container, dark/earthy color palette, or responsive grid layout.
- **No "Planned Feature" Badges:** Never label any section as a "Planned Feature" or "Coming Soon". Every feature on the page must function as a live, interactive prototype.
- **Self-Contained State:** Ensure all interactive tabs, sliders, calculators, and modals work immediately in the browser using clean Vanilla JS / React state (matching the existing repo stack) with zero broken imports or missing API keys.

## 2. CORE PRODUCT LOGIC (DO NOT MIX UP THE TIMELINE)
AgniDrishti ("INSAT-3DS + Sentinel-2") operates in two strict chronological stages in Sangrur, Barnala, and Patiala (Punjab):

### Stage 1: Pre-Burn Farmer Intervention (72 Hours BEFORE Fire)
- **Trigger:** Sentinel-2 (10m) detects a sharp NDVI drop (`0.62 -> 0.18`), meaning paddy harvest is complete and dry stubble is sitting on the field.
- **Action:** Automatically triggers the **Simple Farmer Alert Page** and **Punjabi/Hindi WhatsApp Bot** to connect the farmer with nearby Custom Hiring Centres (CHCs) for machines (Happy Seeders, Balers) and Crop-Residue Buyers (Bio-CNG, Pellet plants) BEFORE they light a match.

### Stage 2: All-Day Watch & Officer Evidence Fusion (DURING & AFTER Fire)
- **Why VIIRS/MODIS Fails:** NASA polar satellites pass once at ~13:30 IST. Farmers wait until 16:00–18:30 IST to burn.
- **Signal 1 (Tripwire):** **INSAT-3DS** (Geostationary, 30-min scans, ~4 km resolution, 3.9 µm MIR band) catches the late-afternoon thermal spike (`>335 K`).
- **Signal 2 (Plot Confirmation):** **Sentinel-2** (10 m resolution, Band 8A NIR & Band 12 SWIR) checks inside that 4 km INSAT cell to confirm a burn scar (`dNBR > +0.35`) mapped to an exact village Khasra plot.
- **Governance Rule:** `🛡️ No Automatic Penalties`. Satellite fusion produces an **Officer Evidence Pack** for Patwari / Nodal Officer field verification.

## 3. THE 4 DECISION STATES ("Two Signals, One Decision")
1. **🔴 Confirmed (2 cases):** INSAT-3DS 4 km heat spike + Sentinel-2 10 m burn scar (`dNBR > +0.35`).
2. **🟡 False Alarm (1 case):** INSAT-3DS heat spike + NO Sentinel-2 scar (`dNBR ~ 0.02`, e.g., brick kiln/industrial flare). Protects farmers from false fines.
3. **🔵 Caught Late (1 case):** No INSAT-3DS spike recorded + Sentinel-2 burn scar found on next clear pass.
4. **☁️ Haze Queue (1 case):** INSAT-3DS heat spike detected, but optical RGB is blocked by thick smog (`AOD > 1.8`). Uses SWIR 2190 nm / Sentinel-1 SAR fallback and tracks wind plume vector.

## 4. CANONICAL DATASET TO USE IN UI
- **CASE-SGR-101 (🔴 Confirmed):** Dirba Block, Sangrur | Khasra #142//8 (3.2 Acres) | Coords: `30.0682, 75.9864` | VIIRS 13:30 IST: `303.1 K` (Missed) | INSAT-3DS Peak: `16:30 IST @ 348.4 K` | Sentinel-2 `dNBR: +0.49` | `NDVI: 0.58 -> 0.11`.
- **CASE-SUN-102 (🔴 Confirmed):** Sunam East, Sangrur | Khasra #89//14 (4.5 Acres) | Coords: `30.1285, 75.8012` | VIIRS 13:30 IST: `304.0 K` | INSAT-3DS Peak: `17:00 IST @ 352.0 K` | Sentinel-2 `dNBR: +0.54` | `NDVI: 0.61 -> 0.09`.
- **CASE-BNL-103 (🟡 False Alarm):** Handiaya Industrial Belt, Barnala | Grid #B-19 | Coords: `30.3410, 75.5480` | INSAT-3DS Peak: `15:00 IST @ 339.2 K` (Brick kiln) | Sentinel-2 `dNBR: +0.02` (No crop scar — Auto-Cleared).
- **CASE-PTL-104 (🔵 Caught Late):** Nabha Rural, Patiala | Khasra #211//3 (2.1 Acres) | Coords: `30.3752, 76.1520` | INSAT-3DS: No spike `>330 K` | Sentinel-2 `dNBR: +0.41` (Ash scar detected post-pass).
- **CASE-SGR-105 (☁️ Haze Queue):** Moonak Border, Sangrur | Sector #M-07 | Coords: `29.8240, 75.8910` | INSAT-3DS Peak: `18:00 IST @ 344.8 K` | Optical Blocked (78% Smog, AOD 1.92) -> SWIR Band-12 / Sentinel-1 SAR Fallback Active.