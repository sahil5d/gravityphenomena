// Unified N-body state and calculations (position, velocity, acceleration, mass)
// Index 0            : MainStar
// Indices 1..NUM_GRID: 8000 GridStars
// Index NUM_GRID + 1 : CenterStar (included when numBodies === NUM_GRID + 2)
const STAR_IDX = 0;
const CENTER_IDX = NUM_GRID + 1;
const MAX_BODIES = NUM_GRID + 2;
var numBodies = NUM_GRID + 1;

const px = new Float64Array(MAX_BODIES);
const py = new Float64Array(MAX_BODIES);
const pz = new Float64Array(MAX_BODIES);

const vx = new Float64Array(MAX_BODIES);
const vy = new Float64Array(MAX_BODIES);
const vz = new Float64Array(MAX_BODIES);

const ax = new Float64Array(MAX_BODIES);
const ay = new Float64Array(MAX_BODIES);
const az = new Float64Array(MAX_BODIES);

const mass = new Float64Array(MAX_BODIES);

// Calculate pairwise gravity between MainStar (0) and all other active bodies (1..numBodies-1)
function calc_accel() {
  var total_fx = 0;
  var total_fy = 0;
  var total_fz = 0;

  const px0 = px[0];
  const py0 = py[0];
  const pz0 = pz[0];
  const m0 = mass[0];
  const GM0 = G * m0;
  const soft2 = CONFIGS[currentConfig].hasCenter ? SOFTENING ** 2 : 0;

  for (var i = 1; i < numBodies; i++) {
    const dx = px[i] - px0;
    const dy = py[i] - py0;
    const dz = pz[i] - pz0;

    const r2 = dx * dx + dy * dy + dz * dz + soft2;
    const r = Math.sqrt(r2);

    // Force magnitude (1/r^2) and direction (dx/r, dy/r, dz/r)
    const g = GM0 / r2;
    const f_mag = g * mass[i];
    const inv_r = 1 / r;
    const ux = dx * inv_r;
    const uy = dy * inv_r;
    const uz = dz * inv_r;

    total_fx += f_mag * ux;
    total_fy += f_mag * uy;
    total_fz += f_mag * uz;

    // Equal and opposite acceleration on body i: a_i = -(G * m0 / r^2) * (dr / r)
    ax[i] = -g * ux;
    ay[i] = -g * uy;
    az[i] = -g * uz;
  }

  ax[0] = total_fx / m0;
  ay[0] = total_fy / m0;
  az[0] = total_fz / m0;
}

// Velocity Verlet first half-kick and position drift:
// v(t + dt/2) = v(t) + 1/2*a(t)*dt
// p(t + dt)   = p(t) + v(t + dt/2)*dt
function calc_pos() {
  const half_dt = 0.5 * timestep;
  for (var i = 0; i < numBodies; i++) {
    vx[i] += ax[i] * half_dt;
    vy[i] += ay[i] * half_dt;
    vz[i] += az[i] * half_dt;

    px[i] += vx[i] * timestep;
    py[i] += vy[i] * timestep;
    pz[i] += vz[i] * timestep;
  }
}

// Velocity Verlet new acceleration and second half-kick:
// v(t + dt) = v(t + dt/2) + 1/2*a(t + dt)*dt
function calc_vel_and_accelnext() {
  calc_accel();
  const half_dt = 0.5 * timestep;
  for (var i = 0; i < numBodies; i++) {
    vx[i] += ax[i] * half_dt;
    vy[i] += ay[i] * half_dt;
    vz[i] += az[i] * half_dt;
  }
}

// Calculate momentum (kg * m/s) and kinetic exergy, gravitational energy,
// and total ergy in Joules (J = kg * m^2 / s^2)
function calc_diagnostics() {
  const m0 = mass[0];
  const mom_star = m0 * vx[0];
  const ke_star = 0.5 * m0 * (vx[0] * vx[0] + vy[0] * vy[0] + vz[0] * vz[0]);

  var mom_group = 0;
  var ke_group = 0;
  var pe_total = 0;

  const px0 = px[0];
  const py0 = py[0];
  const pz0 = pz[0];
  const GM0 = G * m0;
  const soft2 = CONFIGS[currentConfig].hasCenter ? SOFTENING ** 2 : 0;

  for (var i = 1; i < numBodies; i++) {
    const mi = mass[i];
    mom_group += mi * vx[i];
    ke_group += 0.5 * mi * (vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);

    const dx = px[i] - px0;
    const dy = py[i] - py0;
    const dz = pz[i] - pz0;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz + soft2);
    pe_total += (-GM0 * mi) / r;
  }

  const ke_total = ke_star + ke_group;
  return {
    mom_star: mom_star,
    mom_group: mom_group,
    mom_total: mom_star + mom_group,
    ke_star: ke_star,
    ke_group: ke_group,
    ke_total: ke_total,
    pe_total: pe_total,
    te_total: ke_total + pe_total,
  };
}
