// Simulation configurations and UI configuration selectors
const CONFIGS = {
  1: { xStart: -36 * lightyear, yStart: 0,              hasCenter: false }, // left-of-center (m)
  2: { xStart: 0,               yStart: 0,              hasCenter: false }, // center of grid (m)
  3: { xStart: 36 * lightyear,  yStart: 0,              hasCenter: false }, // right-of-center (m)
  4: { xStart: 0,               yStart: 20 * lightyear, hasCenter: true },  // orbit & spiral in (m)
};

const GRID_SCALES = {
  1: 1.0, // 1x size (r = 30.4 ly)
  2: 3.0, // 3x size (r = 91.2 ly)
  3: 9.0, // 9x size (r = 273.6 ly)
};

const VEL_SCALES = {
  1: 1.0, // 1x vel (1.3 km/s)
  2: 3.0, // 3x vel (3.9 km/s)
  3: 9.0, // 9x vel (11.7 km/s)
};

const MASS_SCALES = {
  1: 1.0,   // 1x mass   (0.15 M_sun)
  2: 1 / 3, // 1/3x mass (0.05 M_sun)
  3: 1 / 9, // 1/9x mass (0.017 M_sun)
};

var currentConfig = 1;
var currentGridScale = 1;
var currentVelScale = 1;
var currentMassScale = 1;

function set_active_btn(prefix, count, activeNum) {
  for (var n = 1; n <= count; n++) {
    document.getElementById(prefix + '-' + n).classList.toggle('active', n === activeNum);
  }
  init_sim();
}

function select_config(n)     { currentConfig = n;    set_active_btn('cfg',  4, n); }
function select_grid_scale(n) { currentGridScale = n; set_active_btn('grid', 3, n); }
function select_vel_scale(n)  { currentVelScale = n;  set_active_btn('vel',  3, n); }
function select_mass_scale(n) { currentMassScale = n; set_active_btn('mass', 3, n); }

function bind_group(prefix, count, onSelect) {
  for (let n = 1; n <= count; n++) {
    document.getElementById(prefix + '-' + n).addEventListener('click', () => onSelect(n));
  }
}

function bind_config_controls() {
  bind_group('cfg',  4, select_config);
  bind_group('grid', 3, select_grid_scale);
  bind_group('vel',  3, select_vel_scale);
  bind_group('mass', 3, select_mass_scale);

  document.getElementById('btn-restart').addEventListener('click', () => {
    init_sim();
  });

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    btnPause.classList.toggle('active', paused);
  });

  if (btnCollapse) {
    btnCollapse.addEventListener('click', () => {
      const isCollapsed = hudEl.classList.toggle('collapsed');
      btnCollapse.textContent = isCollapsed ? '+' : '−';
      if (!isCollapsed) draw_sparkline();
    });
  }

  if (btnCam) {
    btnCam.addEventListener('click', () => {
      camera.position.set(0, 13, 141);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }
}
