// Simulation constants and helper functions
// All physics/object variables are stored in SI units: meter (m), kilogram (kg), second (s)
// Display functions convert to lightyears (ly), solar masses (M_sun), years (yr), and km/s
const G = 6.6743 * 10 ** -11;          // m^3 / (kg s^2)
const C = 2.9979 * 10 ** 8;            // m / s
const M_sun = 1.988 * 10 ** 30;        // kg
const year = 365.25 * 86400;           // s
const lightyear = C * year;            // m
const km_s = 1000;                     // m / s

const M_star = 600 * M_sun;            // kg (mass of MainStar)
const BASE_M_GRIDSTAR = 0.15 * M_sun;  // kg (base mass of each star on the 20x20x20 grid)
var M_gridstar = BASE_M_GRIDSTAR;      // kg (active mass of each grid star)
const BASE_M_CENTER = 2900 * M_sun;    // kg (base central mass for orbital inspiral config 4)
var M_center = BASE_M_CENTER;          // kg (active central mass for config 4)

const GRID_N = 20;                     // 20 x 20 x 20 = 8000 stars
const NUM_GRID = GRID_N * GRID_N * GRID_N;
const BASE_SPACING = 3.2 * lightyear;  // m (base grid spacing: -30.4 ly to +30.4 ly at 1x)

const BASE_V0 = 1.3 * km_s;            // m / s (base 1.3 km/s initial rightward velocity)
var V0 = BASE_V0;                      // m / s (active initial rightward velocity)
const timestep = 11000 * year;         // s (11,000 years per step)
const SOFTENING = 1.5 * lightyear;     // m (softening length used in Config 4)

const stepsmax = 1800;
const stepsuntilrender = 4;

// Velocity history (km/s) for HUD sparkline
const velHistory = new Float32Array(stepsmax + 1);
var velHistoryLen = 0;

// HUD element references
const hudEl = document.getElementById('hud');
const hudVel = document.getElementById('hud-vel');
const hudSparkline = document.getElementById('hud-sparkline');
const sparkCtx = hudSparkline ? hudSparkline.getContext('2d') : null;
const hudV0 = document.getElementById('hud-v0');
const hudDv = document.getElementById('hud-dv');
const hudX = document.getElementById('hud-x');
const hudStep = document.getElementById('hud-step');
const hudTimeBar = document.getElementById('hud-time-bar');
const hudParamVel = document.getElementById('hud-param-vel');
const hudParamMass = document.getElementById('hud-param-mass');
const hudParamGrid = document.getElementById('hud-param-grid');
const hudMomStar = document.getElementById('hud-mom-star');
const hudMomGroup = document.getElementById('hud-mom-group');
const hudMomTotal = document.getElementById('hud-mom-total');
const hudKeStar = document.getElementById('hud-ke-star');
const hudKeGroup = document.getElementById('hud-ke-group');
const hudKeTotal = document.getElementById('hud-ke-total');
const hudPeTotal = document.getElementById('hud-pe-total');
const hudTeTotal = document.getElementById('hud-te-total');
const btnPause = document.getElementById('btn-pause');
const btnCollapse = document.getElementById('btn-collapse');
const btnCam = document.getElementById('btn-cam');

// Reset 20 x 20 x 20 grid stars (indices 1..NUM_GRID) to motionless lattice positions
function reset_grid_lattice(spacing) {
  var idx = 1;
  const halfOffset = (GRID_N - 1) / 2;
  for (var ix = 0; ix < GRID_N; ix++) {
    for (var iy = 0; iy < GRID_N; iy++) {
      for (var iz = 0; iz < GRID_N; iz++) {
        px[idx] = (ix - halfOffset) * spacing;
        py[idx] = (iy - halfOffset) * spacing;
        pz[idx] = (iz - halfOffset) * spacing;

        vx[idx] = 0;
        vy[idx] = 0;
        vz[idx] = 0;

        ax[idx] = 0;
        ay[idx] = 0;
        az[idx] = 0;

        mass[idx] = M_gridstar;
        idx++;
      }
    }
  }
}

// Update Three.js Sprite positions (converted from meters to lightyears for 3D scene display)
function update_meshes() {
  const inv_ly = 1 / lightyear;
  movingStarMesh.position.set(
    px[0] * inv_ly,
    py[0] * inv_ly,
    pz[0] * inv_ly
  );

  if (centerStarMesh) {
    const showCenter = CONFIGS[currentConfig].hasCenter;
    centerStarMesh.visible = showCenter;
    if (showCenter) {
      centerStarMesh.position.set(
        px[CENTER_IDX] * inv_ly,
        py[CENTER_IDX] * inv_ly,
        pz[CENTER_IDX] * inv_ly
      );
    }
  }

  for (var i = 1, j = 0; i <= NUM_GRID; i++, j += 3) {
    gridPositions[j] = px[i] * inv_ly;
    gridPositions[j + 1] = py[i] * inv_ly;
    gridPositions[j + 2] = pz[i] * inv_ly;
  }
  gridPosAttr.needsUpdate = true;
}

function fmt_sci(val) {
  if (Math.abs(val) < 1e-18) return '0.00';
  return val.toExponential(2);
}

function get_exp(val) {
  const abs = Math.abs(val);
  if (abs < 1e-30) return 0;
  return Math.floor(Math.log10(abs));
}

function fmt_with_exp(val, exp) {
  const scaled = val / 10 ** exp;
  const clean = Math.abs(scaled) < 0.005 ? 0 : scaled;
  const sign = exp >= 0 ? '+' : '';
  return clean.toFixed(2) + 'e' + sign + exp;
}

// Draw crisp HiDPI velocity sparkline on HUD canvas
function draw_sparkline() {
  if (!sparkCtx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = hudSparkline.clientWidth || 336;
  const h = hudSparkline.clientHeight || 54;
  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);
  if (hudSparkline.width !== targetW || hudSparkline.height !== targetH) {
    hudSparkline.width = targetW;
    hudSparkline.height = targetH;
  }
  sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sparkCtx.clearRect(0, 0, w, h);

  const v0_kms = V0 / km_s;
  const vMin = 0;
  const vMax = 2.0 * v0_kms;
  const padY = 6;
  const plotH = h - 2 * padY;

  // Crisp 1px dashed reference line at v0
  const yRef = Math.floor(h - ((v0_kms - vMin) / (vMax - vMin)) * plotH - padY) + 0.5;
  sparkCtx.strokeStyle = '#323742';
  sparkCtx.lineWidth = 1;
  sparkCtx.setLineDash([3, 3]);
  sparkCtx.beginPath();
  sparkCtx.moveTo(0, yRef);
  sparkCtx.lineTo(w, yRef);
  sparkCtx.stroke();
  sparkCtx.setLineDash([]);

  if (velHistoryLen < 1) return;

  var lastX = 3;
  var lastY = yRef;

  // Single-pass path construction for both stroke and area fill
  sparkCtx.strokeStyle = '#eef2f8';
  sparkCtx.lineWidth = 1.4;
  sparkCtx.lineJoin = 'round';
  sparkCtx.lineCap = 'round';
  sparkCtx.beginPath();
  for (var i = 0; i < velHistoryLen; i++) {
    const x = (i / stepsmax) * (w - 6) + 3;
    const vClamped = Math.max(vMin, Math.min(vMax, velHistory[i]));
    const y = h - ((vClamped - vMin) / (vMax - vMin)) * plotH - padY;
    if (i === 0) {
      sparkCtx.moveTo(x, y);
    } else {
      sparkCtx.lineTo(x, y);
    }
    lastX = x;
    lastY = y;
  }
  sparkCtx.stroke();

  // Close path to bottom corners for subtle area fill
  sparkCtx.lineTo(lastX, h);
  sparkCtx.lineTo(3, h);
  sparkCtx.closePath();
  sparkCtx.fillStyle = 'rgba(200, 210, 228, 0.08)';
  sparkCtx.fill();

  // Live endpoint dot
  sparkCtx.fillStyle = '#ffffff';
  sparkCtx.beginPath();
  sparkCtx.arc(lastX, lastY, 2.2, 0, Math.PI * 2);
  sparkCtx.fill();
}

// Update static parameter readouts when a run is initialized
function update_hud_params() {
  const v0_kms = V0 / km_s;
  hudV0.textContent = Number(v0_kms.toFixed(2)).toString();

  if (hudParamVel) {
    hudParamVel.textContent = Number(v0_kms.toFixed(2)) + ' km/s';
  }
  if (hudParamMass) {
    const m_sun_val = M_gridstar / M_sun;
    hudParamMass.innerHTML = Number(m_sun_val.toFixed(3)) + ' M<sub>☉</sub>';
  }
  if (hudParamGrid) {
    const r_ly = ((GRID_N - 1) / 2) * (BASE_SPACING / lightyear) * GRID_SCALES[currentGridScale];
    hudParamGrid.textContent = '±' + Number(r_ly.toFixed(1)) + ' ly';
  }
}

// Update HUD readout (converting SI m, kg, s to ly, M_sun, yr, km/s, J)
function update_hud() {
  const speed_m_s = Math.hypot(vx[0], vy[0], vz[0]);
  const v_kms = speed_m_s / km_s;
  const v0_kms = V0 / km_s;
  const pctChange = ((v_kms - v0_kms) / v0_kms) * 100;

  const time_myr = (steps * timestep) / (1e6 * year);
  const max_myr = (stepsmax * timestep) / (1e6 * year);

  hudVel.textContent = v_kms.toFixed(4);
  hudDv.textContent = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%';

  const x_ly = (px[0] / lightyear).toFixed(1);
  if (CONFIGS[currentConfig].hasCenter) {
    const y_ly = (py[0] / lightyear).toFixed(1);
    hudX.textContent = x_ly + ', ' + y_ly;
  } else {
    hudX.textContent = 'x = ' + x_ly;
  }

  hudStep.textContent = time_myr.toFixed(2) + ' / ' + max_myr.toFixed(1);
  if (hudTimeBar) {
    hudTimeBar.style.width = ((steps / stepsmax) * 100).toFixed(1) + '%';
  }

  const diag = calc_diagnostics();
  const mom_unit = M_sun * (lightyear / year); // 1 M_sun * ly / yr in kg * m / s
  const mom_star_disp = diag.mom_star / mom_unit;
  const mom_group_disp = diag.mom_group / mom_unit;
  const mom_total_disp = diag.mom_total / mom_unit;

  const mom_exp = get_exp((M_star * V0) / mom_unit);
  const ke_exp = get_exp(diag.ke_star);

  hudMomStar.textContent = fmt_with_exp(mom_star_disp, mom_exp);
  hudMomGroup.textContent = fmt_with_exp(mom_group_disp, mom_exp);
  hudMomTotal.textContent = fmt_with_exp(mom_total_disp, mom_exp);
  hudKeStar.textContent = fmt_with_exp(diag.ke_star, ke_exp);
  hudKeGroup.textContent = fmt_with_exp(diag.ke_group, ke_exp);
  hudKeTotal.textContent = fmt_with_exp(diag.ke_total, ke_exp);
  hudPeTotal.textContent = fmt_sci(diag.pe_total);
  hudTeTotal.textContent = fmt_sci(diag.te_total);

  draw_sparkline();
}
