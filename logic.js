// Scene setup and timestep simulation loop
var scene;
var camera;
var renderer;
var controls;

var movingStarMesh;
var centerStarMesh;
var gridPoints;
var gridPosAttr;
const gridPositions = new Float32Array(NUM_GRID * 3);

var steps = 0;
var paused = false;
var finished = false;

async function setup() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#111215');

  camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.5,
    25000
  );

  camera.position.set(0, 13, 141);

  renderer = new THREE.WebGPURenderer({
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  await renderer.init();

  // Check this only AFTER renderer.init() resolves
  const isUsingWebGPU = renderer.backend.isWebGPUBackend;
  console.log(`Active Pipeline: ${isUsingWebGPU ? 'WebGPU' : 'WebGL 2 fallback'}`);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  document.querySelector('#thescene').appendChild(renderer.domElement);

  // Shared procedural circle mask for all SpriteNodeMaterials (discards corners outside r = 0.5)
  const circleMask = THREE.TSL.uv().sub(0.5).length().lessThanEqual(0.5);

  // MainStar Sprite (same 0.45 ly size as GridStars)
  const starMat = new THREE.SpriteNodeMaterial({
    color: '#ffffff',
    maskNode: circleMask,
    transparent: false,
  });
  movingStarMesh = new THREE.Sprite(starMat);
  movingStarMesh.scale.set(0.45, 0.45, 1.0);
  scene.add(movingStarMesh);

  // Central mass Sprite (shown in Config 4 orbital inspiral)
  const centerMat = new THREE.SpriteNodeMaterial({
    color: '#c8d0dc',
    maskNode: circleMask,
    transparent: false,
  });
  centerStarMesh = new THREE.Sprite(centerMat);
  centerStarMesh.scale.set(1.8, 1.8, 1.0);
  centerStarMesh.visible = false;
  scene.add(centerStarMesh);

  // 20 x 20 x 20 = 8000 grid stars in a single instanced Sprite draw call
  gridPosAttr = new THREE.InstancedBufferAttribute(gridPositions, 3);
  gridPosAttr.setUsage(THREE.DynamicDrawUsage);

  const gridMat = new THREE.SpriteNodeMaterial({
    color: '#8e97a8',
    positionNode: THREE.TSL.instancedDynamicBufferAttribute(gridPosAttr),
    scaleNode: THREE.TSL.float(0.45),
    maskNode: circleMask,
    transparent: false,
  });
  gridPoints = new THREE.Sprite(gridMat);
  gridPoints.count = NUM_GRID;
  gridPoints.frustumCulled = false;
  scene.add(gridPoints);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function init_sim() {
  steps = 0;
  finished = false;
  paused = false;
  btnPause.textContent = '⏸ Pause';
  btnPause.classList.remove('active');

  const vScale = VEL_SCALES[currentVelScale];
  V0 = BASE_V0 * vScale;
  M_gridstar = BASE_M_GRIDSTAR * MASS_SCALES[currentMassScale];
  M_center = BASE_M_CENTER * vScale * vScale;

  // Body 0: MainStar
  px[0] = CONFIGS[currentConfig].xStart;
  py[0] = CONFIGS[currentConfig].yStart;
  pz[0] = 0;
  vx[0] = V0;
  vy[0] = 0;
  vz[0] = 0;
  ax[0] = 0;
  ay[0] = 0;
  az[0] = 0;
  mass[0] = M_star;

  // Bodies 1..NUM_GRID: GridStars
  const spacing = BASE_SPACING * GRID_SCALES[currentGridScale];
  reset_grid_lattice(spacing);

  // Body CENTER_IDX: CenterStar (active when Config 4 is selected)
  px[CENTER_IDX] = 0;
  py[CENTER_IDX] = 0;
  pz[CENTER_IDX] = 0;
  vx[CENTER_IDX] = CONFIGS[currentConfig].hasCenter ? -(M_star / M_center) * V0 : 0;
  vy[CENTER_IDX] = 0;
  vz[CENTER_IDX] = 0;
  ax[CENTER_IDX] = 0;
  ay[CENTER_IDX] = 0;
  az[CENTER_IDX] = 0;
  mass[CENTER_IDX] = M_center;

  numBodies = CONFIGS[currentConfig].hasCenter ? NUM_GRID + 2 : NUM_GRID + 1;

  calc_accel();

  velHistory[0] = V0 / km_s;
  velHistoryLen = 1;

  update_meshes();
  update_hud_params();
  update_hud();
}

function logic_step() {
  calc_pos();
  calc_vel_and_accelnext();
  steps++;
  velHistory[steps] = Math.hypot(vx[0], vy[0], vz[0]) / km_s;
  velHistoryLen = steps + 1;
}

function run_sim() {
  if (!paused && !finished) {
    for (var i = 0; i < stepsuntilrender; i++) {
      if (steps >= stepsmax) {
        finished = true;
        break;
      }
      logic_step();
    }
    update_meshes();
    update_hud();
  }

  controls.update();
  renderer.render(scene, camera);
}

async function start() {
  await setup();
  bind_config_controls();
  init_sim();
  renderer.setAnimationLoop(run_sim);
}

start();
