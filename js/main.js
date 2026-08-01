/* ========================================
 *  赛博痛墙 - Cyber Ita Wall
 *  基于 Three.js 的3D痛墙装扮系统
 * ======================================== */

// ===== 全局错误捕获（把错误显示到页面上） =====
window.addEventListener('error', function(e) {
  showError('错误: ' + e.message + '\n位置: ' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
  showError('Promise错误: ' + e.reason);
});

function showError(msg) {
  console.error(msg);
  var loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = '<div style="color:#ff5050;font-size:16px;text-align:center;max-width:500px;padding:20px;">' +
      '<div style="font-size:40px;margin-bottom:10px;">⚠️</div>' +
      '<div style="margin-bottom:10px;">页面加载出错了</div>' +
      '<div style="font-size:12px;opacity:0.8;white-space:pre-wrap;text-align:left;">' + msg + '</div>' +
      '</div>';
  }
}

// 标记拖拽状态
let _isDraggingNow = false;
let OrbitControls, DragControls;

// ===== 全局变量 =====
let scene, camera, renderer;
let orbitControls, dragControls;
let wall, frameGroup;
let decorations = [];
let selectedObject = null;
let raycaster, mouse;
let mainLight, fillLight, rimLight, ambientLight;
let itemCounter = 0;
let maxAnisotropy = 1;

// 墙面配置
const WALL_CONFIG = {
  width: 16,
  height: 10,
  color: 0x1a0a2e,
  frameColor: 0xff00ff
};

// 物品类型定义
const ITEM_TYPES = {
  badge: {
    name: '徽章',
    width: 1.2,
    height: 1.2,
    depth: 0.08,
    hasImage: true,
    shape: 'circle',
    defaultColor: 0xff6b9d
  },
  polaroid: {
    name: '拍立得',
    width: 1.8,
    height: 2.2,
    depth: 0.06,
    hasImage: true,
    shape: 'polaroid',
    defaultColor: 0xffffff
  },
  card: {
    name: '卡片',
    width: 1.6,
    height: 2.4,
    depth: 0.05,
    hasImage: true,
    shape: 'rect',
    defaultColor: 0x4fc3f7
  },
  stand: {
    name: '立牌',
    width: 1.4,
    height: 2.0,
    depth: 0.1,
    hasImage: true,
    shape: 'stand',
    defaultColor: 0xffd54f
  },
  petal: {
    name: '花瓣',
    width: 0.6,
    height: 0.6,
    depth: 0.02,
    hasImage: false,
    shape: 'petal',
    defaultColor: 0xffb6c1
  },
  star: {
    name: '星星',
    width: 0.8,
    height: 0.8,
    depth: 0.04,
    hasImage: false,
    shape: 'star',
    defaultColor: 0xffeb3b
  }
};

// ===== 初始化 =====
function init() {
  try {
    // ===== 1. 检查 THREE.js 是否加载成功 =====
    if (typeof THREE === 'undefined') {
      throw new Error('THREE.js 未加载，请检查 js/libs/three.min.js 是否存在');
    }
    console.log('✅ THREE.js 已加载, 版本:', THREE.REVISION);

    // ===== 2. 检查扩展控件 =====
    if (typeof THREE.OrbitControls === 'undefined') {
      throw new Error('OrbitControls 未加载，请检查 js/libs/OrbitControls.js');
    }
    if (typeof THREE.DragControls === 'undefined') {
      throw new Error('DragControls 未加载，请检查 js/libs/DragControls.js');
    }
    OrbitControls = THREE.OrbitControls;
    DragControls = THREE.DragControls;
    console.log('✅ 扩展控件已加载');

    // ===== 3. 检查 WebGL 支持 =====
    var testCanvas = document.createElement('canvas');
    var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('你的浏览器不支持 WebGL，请更换 Chrome/Edge/Firefox 最新版');
    }
    console.log('✅ WebGL 支持正常');

    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0015);
    scene.fog = new THREE.Fog(0x0a0015, 20, 50);

    // 相机
    camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 14);

    // 渲染器
    const container = document.getElementById('scene-container');
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    container.appendChild(renderer.domElement);
    maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    console.log('✅ 渲染器初始化完成, 最大各向异性:', maxAnisotropy);

    // 射线检测
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 创建墙面
    createWall();

    // 创建光照
    createLights();

    // 创建装饰边框
    createFrame();

    // 控制器
    setupControls();

    // 事件监听
    setupEventListeners();

    // 默认添加一些示例物品
    addDefaultItems();
    console.log('✅ 场景初始化完成，物品数:', decorations.length);

    // 动画循环
    animate();

    // 隐藏加载动画
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
        setTimeout(() => { if (loading) loading.style.display = 'none'; }, 500);
      }
    }, 500);

  } catch (err) {
    console.error('❌ 初始化失败:', err);
    showError(err.message || String(err));
  }
}

// ===== 创建墙面 =====
function createWall() {
  // 主墙面
  const wallGeometry = new THREE.BoxGeometry(
    WALL_CONFIG.width,
    WALL_CONFIG.height,
    0.3
  );
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: WALL_CONFIG.color,
    roughness: 0.7,
    metalness: 0.1
  });
  wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.position.z = -0.15;
  wall.receiveShadow = true;
  wall.name = 'wall';
  scene.add(wall);

  // 墙面纹理细节（赛博网格线）
  const gridHelper = new THREE.GridHelper(
    WALL_CONFIG.width,
    16,
    0xff00ff,
    0x330066
  );
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.position.z = 0.001;
  gridHelper.material.opacity = 0.15;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
}

// ===== 创建边框 =====
function createFrame() {
  frameGroup = new THREE.Group();
  const frameThickness = 0.2;
  const frameDepth = 0.4;
  const hw = WALL_CONFIG.width / 2 + frameThickness / 2;
  const hh = WALL_CONFIG.height / 2 + frameThickness / 2;

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: WALL_CONFIG.frameColor,
    roughness: 0.3,
    metalness: 0.8,
    emissive: WALL_CONFIG.frameColor,
    emissiveIntensity: 0.3
  });

  // 四个边框
  const framePositions = [
    { w: WALL_CONFIG.width + frameThickness * 2, h: frameThickness, x: 0, y: hh },
    { w: WALL_CONFIG.width + frameThickness * 2, h: frameThickness, x: 0, y: -hh },
    { w: frameThickness, h: WALL_CONFIG.height, x: -hw, y: 0 },
    { w: frameThickness, h: WALL_CONFIG.height, x: hw, y: 0 }
  ];

  framePositions.forEach(fp => {
    const geo = new THREE.BoxGeometry(fp.w, fp.h, frameDepth);
    const mesh = new THREE.Mesh(geo, frameMaterial);
    mesh.position.set(fp.x, fp.y, 0);
    mesh.castShadow = true;
    frameGroup.add(mesh);
  });

  // 四角装饰
  const cornerSize = 0.5;
  const corners = [
    { x: -hw, y: hh },
    { x: hw, y: hh },
    { x: -hw, y: -hh },
    { x: hw, y: -hh }
  ];
  corners.forEach(c => {
    const cornerGeo = new THREE.SphereGeometry(cornerSize * 0.4, 16, 16);
    const corner = new THREE.Mesh(cornerGeo, frameMaterial);
    corner.position.set(c.x, c.y, 0.1);
    corner.castShadow = true;
    frameGroup.add(corner);
  });

  scene.add(frameGroup);
}

// ===== 创建光照 =====
function createLights() {
  // 环境光
  ambientLight = new THREE.AmbientLight(0x404080, 0.4);
  scene.add(ambientLight);

  // 主光源（暖白光，模拟台灯）
  mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(5, 8, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -15;
  mainLight.shadow.camera.right = 15;
  mainLight.shadow.camera.top = 15;
  mainLight.shadow.camera.bottom = -15;
  mainLight.shadow.bias = -0.0001;
  scene.add(mainLight);

  // 补光（粉紫色，赛博感）
  fillLight = new THREE.PointLight(0xff00ff, 0.8, 30);
  fillLight.position.set(-6, 3, 5);
  scene.add(fillLight);

  // 轮廓光（青蓝色）
  rimLight = new THREE.PointLight(0x00f0ff, 0.6, 30);
  rimLight.position.set(6, -3, 5);
  scene.add(rimLight);
}

// ===== 控制器 =====
function setupControls() {
  // 轨道控制（视角调节）
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.enablePan = false;
  orbitControls.minDistance = 6;
  orbitControls.maxDistance = 25;
  orbitControls.maxPolarAngle = Math.PI * 0.6;
  orbitControls.minPolarAngle = Math.PI * 0.3;
  orbitControls.target.set(0, 0, 0);
  orbitControls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };

  // 拖拽控制
  dragControls = new DragControls([], camera, renderer.domElement);
  dragControls.enabled = true;

  dragControls.addEventListener('dragstart', function(event) {
    _isDraggingNow = true;
    orbitControls.enabled = false;
    selectedObject = event.object;
    updatePropertyPanel(selectedObject);
    highlightObject(selectedObject);
  });

  dragControls.addEventListener('drag', function(event) {
    const obj = event.object;
    // 限制在墙面范围内
    const hw = WALL_CONFIG.width / 2 - 1;
    const hh = WALL_CONFIG.height / 2 - 1;
    obj.position.x = Math.max(-hw, Math.min(hw, obj.position.x));
    obj.position.y = Math.max(-hh, Math.min(hh, obj.position.y));
    obj.position.z = 0.1 + (obj.userData.depth || 0.05);
  });

  dragControls.addEventListener('dragend', function(event) {
    _isDraggingNow = false;
    orbitControls.enabled = true;
  });
}

// ===== 高亮选中物体 =====
function highlightObject(obj) {
  decorations.forEach(d => {
    if (d.userData.originalEmissive !== undefined) {
      d.traverse(child => {
        if (child.isMesh && child.material) {
          // 有图片的物品不通过修改 emissive 来高亮（避免破坏图片显示）
          if (child.userData.isImage) return;
          if (child.material.emissive) {
            child.material.emissive.setHex(child.userData.originalEmissive || 0x000000);
            child.material.emissiveIntensity = child.userData.originalEmissiveIntensity || 0;
          }
        }
      });
    }
  });

  if (obj) {
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        // 有图片的物品不通过修改 emissive 来高亮（避免破坏图片显示）
        if (child.userData.isImage) return;
        if (child.material.emissive) {
          child.userData.originalEmissive = child.material.emissive.getHex();
          child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
          child.material.emissive.setHex(0x00f0ff);
          child.material.emissiveIntensity = 0.5;
        }
      }
    });
  }
}

// ===== 创建物品 =====
function createDecoration(type, options = {}) {
  const config = ITEM_TYPES[type];
  if (!config) return null;

  itemCounter++;
  const group = new THREE.Group();
  group.userData = {
    type: type,
    id: 'item_' + itemCounter,
    depth: config.depth,
    baseScale: 1,
    color: config.defaultColor,
    hasImage: config.hasImage
  };

  let mainMesh;

  switch (config.shape) {
    case 'circle':
      mainMesh = createBadge(config, options);
      break;
    case 'polaroid':
      mainMesh = createPolaroid(config, options);
      break;
    case 'rect':
      mainMesh = createCard(config, options);
      break;
    case 'stand':
      mainMesh = createStand(config, options);
      break;
    case 'petal':
      mainMesh = createPetal(config, options);
      break;
    case 'star':
      mainMesh = createStar(config, options);
      break;
    default:
      mainMesh = createCard(config, options);
  }

  group.add(mainMesh);

  // 随机位置
  if (options.position) {
    group.position.copy(options.position);
  } else {
    group.position.x = (Math.random() - 0.5) * (WALL_CONFIG.width - 3);
    group.position.y = (Math.random() - 0.5) * (WALL_CONFIG.height - 3);
  }
  group.position.z = 0.1 + config.depth;

  // 随机轻微旋转
  if (options.rotation !== undefined) {
    group.rotation.z = options.rotation;
  } else {
    group.rotation.z = (Math.random() - 0.5) * 0.2;
  }

  scene.add(group);
  decorations.push(group);
  updateDragControls();

  return group;
}

// ========== 合成徽章贴图（单张Canvas，不拼接）高分辨率版本 ==========
function composeBadgeTexture(imageUrl) {
  const SIZE = 2048;  // 提高到 2K 分辨率
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  // 开启高质量图像渲染
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. 画圆角方形白底（整体徽章）
  const cornerR = SIZE * 0.18;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, SIZE, SIZE, cornerR);
  ctx.fill();

  // 2. 如果有用户图片，画在中间（保持原比例，不蒙任何颜色）
  const texture = new THREE.CanvasTexture(canvas);
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  // 高质量纹理过滤设置 - 开启 mipmap 提升缩小质量
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(maxAnisotropy, 8);
  texture.needsUpdate = true;

  if (imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // 清空并重新画白底
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 0, 0, SIZE, SIZE, cornerR);
      ctx.fill();

      // 计算图片居中绘制的位置（保持比例）
      const padding = SIZE * 0.1;
      const drawW = SIZE - padding * 2;
      const drawH = SIZE - padding * 2;
      const imgRatio = img.width / img.height;
      const drawRatio = drawW / drawH;
      let sx, sy, sw, sh;
      if (imgRatio > drawRatio) {
        // 图片更宽，裁两边
        sw = img.height * drawRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        // 图片更高，裁上下
        sw = img.width;
        sh = img.width / drawRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }

      // 保存上下文，裁剪成圆角方形区域（只在徽章区域内画图）
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, padding, padding, drawW, drawH, cornerR * 0.5);
      ctx.clip();
      // 直接 drawImage，不叠加任何颜色滤镜
      ctx.drawImage(img, sx, sy, sw, sh, padding, padding, drawW, drawH);
      ctx.restore();

      // 标记纹理需要更新，并强制重新生成 mipmaps
      texture.needsUpdate = true;
      if (texture.minFilter === THREE.LinearMipmapLinearFilter ||
          texture.minFilter === THREE.LinearMipmapNearestFilter ||
          texture.minFilter === THREE.NearestMipmapLinearFilter ||
          texture.minFilter === THREE.NearestMipmapNearestFilter) {
        texture.generateMipmaps = true;
      }
    };
    img.src = imageUrl;
  } else {
    // 默认：中间画个 + 号
    ctx.fillStyle = '#e8e8e8';
    const p = SIZE * 0.1;
    roundRect(ctx, p, p, SIZE - p*2, SIZE - p*2, cornerR * 0.5);
    ctx.fill();
    ctx.fillStyle = '#bbbbbb';
    ctx.font = 'bold 240px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', SIZE/2, SIZE/2);
  }

  return texture;
}

// ========== 合成拍立得贴图（单张Canvas，不拼接）高分辨率版本 ==========
function composePolaroidTexture(imageUrl) {
  const W = 2048;
  const H = 2560;  // 2K 分辨率
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // 开启高质量图像渲染
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cornerR = 56;
  const borderL = 110, borderR = 110;
  const borderT = 110, borderB = 570;
  const photoX = borderL, photoY = borderT;
  const photoW = W - borderL - borderR;
  const photoH = H * 0.72 - borderT;

  // 1. 画整体相纸（圆角矩形）
  ctx.fillStyle = '#faf8f0';
  roundRect(ctx, 0, 0, W, H, cornerR);
  ctx.fill();

  // 2. 画照片区（深色底）
  ctx.fillStyle = '#1a1a1a';
  roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 16);
  ctx.fill();

  // 3. 画底部手写横线
  const writeY1 = photoY + photoH + 70;
  const writeY2 = H - 90;
  ctx.fillStyle = 'rgba(245, 240, 225, 0.6)';
  ctx.fillRect(photoX, writeY1, photoW, writeY2 - writeY1);
  ctx.strokeStyle = 'rgba(170, 155, 120, 0.35)';
  ctx.lineWidth = 4;
  for (let i = 1; i <= 5; i++) {
    const y = writeY1 + (writeY2 - writeY1) * i / 6;
    ctx.beginPath();
    ctx.moveTo(photoX + 40, y);
    ctx.lineTo(photoX + photoW - 40, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  // 高质量纹理过滤设置 - 开启 mipmap 提升缩小质量
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(maxAnisotropy, 8);
  texture.needsUpdate = true;

  // 4. 如果有用户图片，画在照片区
  if (imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // 重绘整体（2K 尺寸）
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#faf8f0';
      roundRect(ctx, 0, 0, W, H, cornerR);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 16);
      ctx.fill();
      // 手写横线
      ctx.fillStyle = 'rgba(245, 240, 225, 0.6)';
      ctx.fillRect(photoX, writeY1, photoW, writeY2 - writeY1);
      ctx.strokeStyle = 'rgba(170, 155, 120, 0.35)';
      ctx.lineWidth = 4;
      for (let i = 1; i <= 5; i++) {
        const y = writeY1 + (writeY2 - writeY1) * i / 6;
        ctx.beginPath();
        ctx.moveTo(photoX + 40, y);
        ctx.lineTo(photoX + photoW - 40, y);
        ctx.stroke();
      }

      // 计算图片绘制（保持比例裁剪居中）
      const pad = 16;
      const dw = photoW - pad * 2;
      const dh = photoH - pad * 2;
      const imgRatio = img.width / img.height;
      const drawRatio = dw / dh;
      let sx, sy, sw, sh;
      if (imgRatio > drawRatio) {
        sw = img.height * drawRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / drawRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }

      // 裁剪成圆角
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, photoX + pad, photoY + pad, dw, dh, cornerR - 12);
      ctx.clip();
      // 直接 drawImage，不叠加颜色
      ctx.drawImage(img, sx, sy, sw, sh, photoX + pad, photoY + pad, dw, dh);
      ctx.restore();

      // 标记纹理需要更新，并强制重新生成 mipmaps
      texture.needsUpdate = true;
      if (texture.minFilter === THREE.LinearMipmapLinearFilter ||
          texture.minFilter === THREE.LinearMipmapNearestFilter ||
          texture.minFilter === THREE.NearestMipmapLinearFilter ||
          texture.minFilter === THREE.NearestMipmapNearestFilter) {
        texture.generateMipmaps = true;
      }
    };
    img.src = imageUrl;
  } else {
    // 默认 + 号
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const p = 16;
    roundRect(ctx, photoX + p, photoY + p, photoW - p*2, photoH - p*2, cornerR - 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 200px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', photoX + photoW/2, photoY + photoH/2);
  }

  return texture;
}

// ========== 合成卡片贴图（单张Canvas，不拼接）高分辨率版本 ==========
function composeCardTexture(imageUrl, colorHex) {
  const W = 2048;
  const H = 3072;  // 2K 分辨率，宽高比 2:3
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cornerR = 80;
  const borderW = 60;

  // 1. 画整体卡片底色（圆角矩形）
  const baseColor = toCssColor(colorHex || 0x4fc3f7);
  ctx.fillStyle = baseColor;
  roundRect(ctx, 0, 0, W, H, cornerR);
  ctx.fill();

  // 2. 画边框（赛博发光感）
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = borderW;
  roundRect(ctx, borderW/2, borderW/2, W - borderW, H - borderW, cornerR - borderW/2);
  ctx.stroke();

  // 3. 画图片区域（深色底）
  const padX = 120;
  const padY = 180;
  const photoX = padX;
  const photoY = padY;
  const photoW = W - padX * 2;
  const photoH = H - padY * 2;
  ctx.fillStyle = '#1a1a2e';
  roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 30);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(maxAnisotropy, 8);
  texture.needsUpdate = true;

  // 4. 如果有用户图片，画在图片区域
  if (imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // 重绘整体
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = baseColor;
      roundRect(ctx, 0, 0, W, H, cornerR);
      ctx.fill();
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = borderW;
      roundRect(ctx, borderW/2, borderW/2, W - borderW, H - borderW, cornerR - borderW/2);
      ctx.stroke();
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 30);
      ctx.fill();

      // 计算图片绘制（保持比例裁剪居中）
      const pad = 20;
      const dw = photoW - pad * 2;
      const dh = photoH - pad * 2;
      const imgRatio = img.width / img.height;
      const drawRatio = dw / dh;
      let sx, sy, sw, sh;
      if (imgRatio > drawRatio) {
        sw = img.height * drawRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / drawRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }

      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, photoX + pad, photoY + pad, dw, dh, cornerR - 40);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, photoX + pad, photoY + pad, dw, dh);
      ctx.restore();

      texture.needsUpdate = true;
      if (texture.minFilter === THREE.LinearMipmapLinearFilter ||
          texture.minFilter === THREE.LinearMipmapNearestFilter ||
          texture.minFilter === THREE.NearestMipmapLinearFilter ||
          texture.minFilter === THREE.NearestMipmapNearestFilter) {
        texture.generateMipmaps = true;
      }
    };
    img.src = imageUrl;
  } else {
    // 默认 + 号
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const p = 20;
    roundRect(ctx, photoX + p, photoY + p, photoW - p*2, photoH - p*2, cornerR - 40);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 240px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', photoX + photoW/2, photoY + photoH/2);
  }

  return texture;
}

// ========== 合成立牌贴图（单张Canvas，不拼接）高分辨率版本 ==========
function composeStandTexture(imageUrl, colorHex) {
  const W = 2048;
  const H = 2944;  // 接近 2:3 比例
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cornerR = 120;

  // 1. 画整体立牌底色（圆角矩形，透明中心放图片）
  const baseColor = toCssColor(colorHex || 0xffd54f);
  ctx.fillStyle = baseColor;
  roundRect(ctx, 0, 0, W, H, cornerR);
  ctx.fill();

  // 2. 画图片区域（居中，带圆角）
  const pad = 120;
  const photoX = pad;
  const photoY = pad;
  const photoW = W - pad * 2;
  const photoH = H - pad * 2;
  ctx.fillStyle = '#1a1a2e';
  roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 40);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(maxAnisotropy, 8);
  texture.needsUpdate = true;

  // 3. 如果有用户图片，画在图片区域
  if (imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // 重绘整体
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = baseColor;
      roundRect(ctx, 0, 0, W, H, cornerR);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, photoX, photoY, photoW, photoH, cornerR - 40);
      ctx.fill();

      // 计算图片绘制（保持比例裁剪居中）
      const pad2 = 16;
      const dw = photoW - pad2 * 2;
      const dh = photoH - pad2 * 2;
      const imgRatio = img.width / img.height;
      const drawRatio = dw / dh;
      let sx, sy, sw, sh;
      if (imgRatio > drawRatio) {
        sw = img.height * drawRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / drawRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }

      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, photoX + pad2, photoY + pad2, dw, dh, cornerR - 50);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, photoX + pad2, photoY + pad2, dw, dh);
      ctx.restore();

      texture.needsUpdate = true;
      if (texture.minFilter === THREE.LinearMipmapLinearFilter ||
          texture.minFilter === THREE.LinearMipmapNearestFilter ||
          texture.minFilter === THREE.NearestMipmapLinearFilter ||
          texture.minFilter === THREE.NearestMipmapNearestFilter) {
        texture.generateMipmaps = true;
      }
    };
    img.src = imageUrl;
  } else {
    // 默认 + 号
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const p = 16;
    roundRect(ctx, photoX + p, photoY + p, photoW - p*2, photoH - p*2, cornerR - 50);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 240px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', photoX + photoW/2, photoY + photoH/2);
  }

  return texture;
}

// ========== Canvas 工具：圆角矩形 ==========
function roundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===== 创建徽章（一个整体，单张贴图，不拼接） =====
function createBadge(config, options) {
  const size = config.width;

  // 一个 PlaneGeometry + 一张合成好的贴图 = 一个整体
  const geo = new THREE.PlaneGeometry(size, size);
  const tex = composeBadgeTexture(options.imageUrl);
  // 使用 emissiveMap 让贴图颜色不受场景彩色光照影响
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    transparent: true,
    roughness: 0.55,
    metalness: 0.0,
    side: THREE.DoubleSide,
    color: 0xffffff
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isImage = config.hasImage;
  mesh.userData.composedTexture = tex;

  return mesh;
}

// ===== 创建拍立得（一个整体，单张贴图，不拼接） =====
function createPolaroid(config, options) {
  const w = config.width;
  const h = config.height;

  // 一个 PlaneGeometry + 一张合成好的贴图 = 一个整体
  const geo = new THREE.PlaneGeometry(w, h);
  const tex = composePolaroidTexture(options.imageUrl);
  // 使用 emissiveMap 让贴图颜色不受场景彩色光照影响
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    transparent: true,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    color: 0xffffff
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isImage = config.hasImage;
  mesh.userData.composedTexture = tex;

  return mesh;
}

// ===== 创建卡片（一个整体，单张贴图，不拼接） =====
function createCard(config, options) {
  const w = config.width;
  const h = config.height;

  // 一个 PlaneGeometry + 一张合成好的贴图 = 一个整体
  const geo = new THREE.PlaneGeometry(w, h);
  const colorHex = options.color || config.defaultColor;
  const tex = composeCardTexture(options.imageUrl, colorHex);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    transparent: true,
    roughness: 0.4,
    metalness: 0.3,
    side: THREE.DoubleSide,
    color: 0xffffff
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isImage = config.hasImage;
  mesh.userData.composedTexture = tex;

  return mesh;
}

// ===== 创建立牌（主体一个整体，底座单独保留） =====
function createStand(config, options) {
  const group = new THREE.Group();
  const w = config.width;
  const h = config.height;
  const colorHex = options.color || config.defaultColor;

  // 立牌主体面板：一个 PlaneGeometry + 一张合成好的贴图 = 一个整体
  const faceGeo = new THREE.PlaneGeometry(w, h);
  const tex = composeStandTexture(options.imageUrl, colorHex);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    transparent: true,
    roughness: 0.3,
    metalness: 0.5,
    side: THREE.DoubleSide,
    color: 0xffffff
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.castShadow = true;
  face.receiveShadow = true;
  face.userData.isImage = config.hasImage;
  face.userData.composedTexture = tex;
  group.add(face);

  // 底座（物理结构，保留）
  const baseW = config.width * 0.6;
  const baseGeo = new THREE.BoxGeometry(baseW, 0.15, config.depth + 0.3);
  const baseMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.3,
    metalness: 0.5,
    emissive: colorHex,
    emissiveIntensity: 0.08
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -config.height / 2 - 0.08;
  base.position.z = -0.1;
  base.castShadow = true;
  group.add(base);

  return group;
}

// ===== 创建花瓣 =====
function createPetal(config, options) {
  const shape = new THREE.Shape();
  const r = config.width / 2;
  shape.moveTo(0, r);
  shape.bezierCurveTo(r * 0.5, r * 0.5, r, 0, 0, -r);
  shape.bezierCurveTo(-r, 0, -r * 0.5, r * 0.5, 0, r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: config.depth,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.02,
    bevelSegments: 3
  });
  geo.center();

  const mat = new THREE.MeshStandardMaterial({
    color: options.color || config.defaultColor,
    roughness: 0.5,
    metalness: 0.2,
    emissive: options.color || config.defaultColor,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide
  });

  const petal = new THREE.Mesh(geo, mat);
  petal.castShadow = true;
  petal.rotation.x = Math.PI / 2;
  return petal;
}

// ===== 创建星星 =====
function createStar(config, options) {
  const shape = new THREE.Shape();
  const outerR = config.width / 2;
  const innerR = outerR * 0.4;
  const points = 5;

  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: config.depth,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.02,
    bevelSegments: 2
  });
  geo.center();

  const mat = new THREE.MeshStandardMaterial({
    color: options.color || config.defaultColor,
    roughness: 0.3,
    metalness: 0.6,
    emissive: options.color || config.defaultColor,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide
  });

  const star = new THREE.Mesh(geo, mat);
  star.castShadow = true;
  star.rotation.x = Math.PI / 2;
  return star;
}

// ===== 创建图片材质 =====
// 把数字颜色（如 0xff6b9d）转成 CSS 十六进制颜色字符串（如 '#ff6b9d'）
function toCssColor(color) {
  if (typeof color === 'string') return color;
  if (typeof color === 'number') return '#' + color.toString(16).padStart(6, '0');
  return '#3a1a5a';
}

// ===== 程序化纹理生成器 =====

// 生成金属拉丝纹理
function createBrushedMetalTexture(baseColorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = toCssColor(baseColorHex);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // 横向拉丝线条
  for (let i = 0; i < 800; i++) {
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.15;
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
    ctx.strokeStyle = shade + alpha + ')';
    ctx.lineWidth = Math.random() * 1.2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  // 细划痕
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = Math.random() * 30 + 5;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = 'rgba(255,255,255,' + (Math.random() * 0.2 + 0.05) + ')';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 生成纸张纹理（用于拍立得边框）
function createPaperTexture(baseColorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = toCssColor(baseColorHex);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // 纸张纤维噪点
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 25;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 暗角
  const vignette = ctx.createRadialGradient(256, 256, 100, 256, 256, 400);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 生成粗糙度贴图（白色=光滑，黑色=粗糙）
function createRoughnessTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (type === 'metal') {
    // 金属：大部分光滑，有划痕
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 100; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (Math.random() * 0.3) + ')';
      ctx.lineWidth = Math.random();
      ctx.beginPath();
      const y = Math.random() * 256;
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  } else {
    // 纸张：整体粗糙
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, 256, 256);
    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 60;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = data[i];
      data[i + 2] = data[i];
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return new THREE.CanvasTexture(canvas);
}

function createImageMaterial(imageUrl, w, h, defaultColor) {
  if (imageUrl) {
    const texture = new THREE.TextureLoader().load(imageUrl);
    if (texture.colorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.max(maxAnisotropy, 8);
    return new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.7,
      metalness: 0.0
    });
  } else {
    // 默认占位图（渐变色）
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    const baseColor = toCssColor(defaultColor || 0x3a1a5a);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.0
    });
  }
}

// ===== 更新拖拽控制对象列表 =====
function updateDragControls() {
  if (!dragControls) return;
  const objs = dragControls.getObjects();
  objs.length = 0;
  decorations.forEach(d => objs.push(d));
}

// ===== 右侧属性面板 =====
function updatePropertyPanel(obj) {
  const panel = document.getElementById('property-panel');
  if (!obj) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  const config = ITEM_TYPES[obj.userData.type];

  // 颜色设置显示/隐藏
  const colorSetting = document.getElementById('color-setting');
  colorSetting.style.display = config.hasImage ? 'none' : 'flex';

  // 当前颜色
  const colorInput = document.getElementById('item-color');
  colorInput.value = '#' + obj.userData.color.toString(16).padStart(6, '0');

  // 当前缩放
  const scaleInput = document.getElementById('item-scale');
  scaleInput.value = obj.scale.x.toFixed(1);

  // 当前旋转
  const rotationInput = document.getElementById('item-rotation');
  rotationInput.value = Math.round(obj.rotation.z * 180 / Math.PI);

  // 清空上传输入
  document.getElementById('upload-image').value = '';
}

// ===== 默认物品 =====
function addDefaultItems() {
  createDecoration('badge', { position: new THREE.Vector3(-4, 2, 0.2) });
  createDecoration('polaroid', { position: new THREE.Vector3(0, 1.5, 0.15) });
  createDecoration('card', { position: new THREE.Vector3(4, 2, 0.15) });
  createDecoration('stand', { position: new THREE.Vector3(-3, -2, 0.2) });
  createDecoration('badge', { position: new THREE.Vector3(3, -1.5, 0.2), color: 0x4fc3f7 });
  createDecoration('petal', { position: new THREE.Vector3(-5, -1, 0.12) });
  createDecoration('star', { position: new THREE.Vector3(5, 3, 0.14) });
  createDecoration('petal', { position: new THREE.Vector3(5.5, -2, 0.12), color: 0xff69b4 });
  createDecoration('star', { position: new THREE.Vector3(-5.5, 3, 0.14), color: 0x00f0ff });
}

// ===== 事件监听 =====
function setupEventListeners() {
  // 窗口大小变化
  window.addEventListener('resize', onWindowResize);

  // 点击物品选中
  renderer.domElement.addEventListener('click', onCanvasClick);

  // 添加物品按钮
  document.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const newItem = createDecoration(type);
      if (newItem) {
        selectedObject = newItem;
        highlightObject(newItem);
        updatePropertyPanel(newItem);
      }
    });
  });

  // 墙面颜色
  document.getElementById('wall-color').addEventListener('input', (e) => {
    const color = parseInt(e.target.value.replace('#', ''), 16);
    WALL_CONFIG.color = color;
    if (wall) wall.material.color.setHex(color);
  });

  // 边框颜色
  document.getElementById('frame-color').addEventListener('input', (e) => {
    const color = parseInt(e.target.value.replace('#', ''), 16);
    WALL_CONFIG.frameColor = color;
    if (frameGroup) {
      frameGroup.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(color);
          if (child.material.emissive) {
            child.material.emissive.setHex(color);
          }
        }
      });
    }
  });

  // 光线强度
  document.getElementById('light-intensity').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainLight) mainLight.intensity = val;
    if (ambientLight) ambientLight.intensity = val * 0.35;
    renderer.toneMappingExposure = val;
  });

  // 物品颜色
  document.getElementById('item-color').addEventListener('input', (e) => {
    if (!selectedObject) return;
    const color = parseInt(e.target.value.replace('#', ''), 16);
    selectedObject.userData.color = color;
    const type = selectedObject.userData.type;

    // 卡片和立牌：改颜色时重新合成贴图
    if (type === 'card' || type === 'stand') {
      let targetMesh = selectedObject;
      if (selectedObject.isGroup) {
        selectedObject.traverse(child => {
          if (child.isMesh && child.userData.isImage) targetMesh = child;
        });
        if (targetMesh === selectedObject || !targetMesh.material || !targetMesh.material.map) {
          selectedObject.traverse(child => {
            if (child.isMesh && child.material && child.material.map) targetMesh = child;
          });
        }
      }
      if (targetMesh && targetMesh.material) {
        let newTex;
        if (type === 'card') {
          newTex = composeCardTexture(null, color);
        } else {
          newTex = composeStandTexture(null, color);
        }
        if (targetMesh.material.map) targetMesh.material.map.dispose();
        if (targetMesh.material.emissiveMap) targetMesh.material.emissiveMap.dispose();
        targetMesh.material.map = newTex;
        targetMesh.material.emissiveMap = newTex;
        targetMesh.material.needsUpdate = true;
        targetMesh.userData.composedTexture = newTex;
      }
    }

    // 其他没有 isImage 标记的子物体（如立牌底座）也更新颜色
    selectedObject.traverse(child => {
      if (child.isMesh && child.material && !child.userData.isImage) {
        if (child.material.color) child.material.color.setHex(color);
        if (child.material.emissive) {
          child.material.emissive.setHex(color);
          child.material.emissiveIntensity = 0.15;
        }
      }
    });
  });

  // 物品缩放
  document.getElementById('item-scale').addEventListener('input', (e) => {
    if (!selectedObject) return;
    const s = parseFloat(e.target.value);
    selectedObject.scale.set(s, s, s);
  });

  // 物品旋转
  document.getElementById('item-rotation').addEventListener('input', (e) => {
    if (!selectedObject) return;
    const deg = parseFloat(e.target.value);
    selectedObject.rotation.z = deg * Math.PI / 180;
  });

  // 上传图片
  document.getElementById('upload-image').addEventListener('change', (e) => {
    if (!selectedObject) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const imageUrl = event.target.result;
      applyImageToObject(selectedObject, imageUrl);
    };
    reader.readAsDataURL(file);
  });

  // 复制
  document.getElementById('btn-duplicate').addEventListener('click', () => {
    if (!selectedObject) return;
    const type = selectedObject.userData.type;
    const pos = selectedObject.position.clone();
    pos.x += 1;
    pos.y += 0.5;
    const newItem = createDecoration(type, {
      position: pos,
      color: selectedObject.userData.color,
      rotation: selectedObject.rotation.z
    });
    if (newItem) {
      newItem.scale.copy(selectedObject.scale);
      selectedObject = newItem;
      highlightObject(newItem);
      updatePropertyPanel(newItem);
    }
  });

  // 删除
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (!selectedObject) return;
    scene.remove(selectedObject);
    const idx = decorations.indexOf(selectedObject);
    if (idx > -1) decorations.splice(idx, 1);
    selectedObject = null;
    highlightObject(null);
    updatePropertyPanel(null);
    updateDragControls();
  });

  // 重置视角
  document.getElementById('btn-reset-view').addEventListener('click', () => {
    camera.position.set(0, 0, 14);
    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
  });

  // 截图
  document.getElementById('btn-screenshot').addEventListener('click', takeScreenshot);

  // 关闭弹窗
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('screenshot-modal').style.display = 'none';
  });

  // 下载
  document.getElementById('btn-download').addEventListener('click', downloadScreenshot);

  // ESC 取消选中
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      selectedObject = null;
      highlightObject(null);
      updatePropertyPanel(null);
    }
  });
}

// ===== 给物品应用图片 =====
function applyImageToObject(obj, imageUrl) {
  // 获取顶层物品（可能是 Group，也可能是 Mesh）
  let top = obj;
  while (top.parent && !decorations.includes(top)) {
    top = top.parent;
  }

  const type = top.userData.type;

  // 徽章、拍立得、卡片、立牌：重新合成单张贴图
  if (type === 'badge' || type === 'polaroid' || type === 'card' || type === 'stand') {
    let newTex;
    if (type === 'badge') {
      newTex = composeBadgeTexture(imageUrl);
    } else if (type === 'polaroid') {
      newTex = composePolaroidTexture(imageUrl);
    } else if (type === 'card') {
      newTex = composeCardTexture(imageUrl, top.userData.color);
    } else {
      newTex = composeStandTexture(imageUrl, top.userData.color);
    }

    // 找到实际的 Mesh（Group 里的 isImage Mesh，或者本身就是 Mesh）
    let targetMesh = top;
    if (top.isGroup) {
      top.traverse(child => {
        if (child.isMesh && child.userData.isImage) targetMesh = child;
      });
      // 如果没有 isImage 标记的，找第一个有 material.map 的 Mesh
      if (targetMesh === top || !targetMesh.material || !targetMesh.material.map) {
        top.traverse(child => {
          if (child.isMesh && child.material && child.material.map) targetMesh = child;
        });
      }
    }

    if (targetMesh && targetMesh.material) {
      if (targetMesh.material.map) {
        targetMesh.material.map.dispose();
      }
      if (targetMesh.material.emissiveMap) {
        targetMesh.material.emissiveMap.dispose();
      }
      targetMesh.material.map = newTex;
      targetMesh.material.emissiveMap = newTex;
      targetMesh.material.emissive = new THREE.Color(0xffffff);
      targetMesh.material.emissiveIntensity = 0.85;
      targetMesh.material.needsUpdate = true;
      targetMesh.userData.composedTexture = newTex;
    }
    return;
  }

  // 其他类型（卡片、立牌等）：沿用旧逻辑
  const loader = new THREE.TextureLoader();
  loader.load(imageUrl, (texture) => {
    if (texture.colorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.max(maxAnisotropy, 8);
    top.traverse(child => {
      if (child.isMesh && child.userData.isImage && child.material) {
        if (child.material.map) {
          child.material.map.dispose();
        }
        if (child.material.emissiveMap) {
          child.material.emissiveMap.dispose();
        }
        child.material.map = texture;
        child.material.emissiveMap = texture;
        child.material.emissive = new THREE.Color(0xffffff);
        child.material.emissiveIntensity = 0.85;
        child.material.needsUpdate = true;
      }
    });
  });
}

// ===== 画布点击 =====
function onCanvasClick(event) {
  if (_isDraggingNow) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(decorations, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj.parent && !decorations.includes(obj)) {
      obj = obj.parent;
    }
    if (decorations.includes(obj)) {
      selectedObject = obj;
      highlightObject(obj);
      updatePropertyPanel(obj);
    }
  }
}

// ===== 窗口调整 =====
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== 截图 =====
let screenshotDataUrl = null;

function takeScreenshot() {
  // 渲染一次最新的画面
  renderer.render(scene, camera);

  // 使用 renderer 的 domElement 直接导出
  const dataUrl = renderer.domElement.toDataURL('image/png');
  screenshotDataUrl = dataUrl;

  document.getElementById('screenshot-preview').src = dataUrl;
  document.getElementById('screenshot-modal').style.display = 'flex';
}

function downloadScreenshot() {
  if (!screenshotDataUrl) return;
  const link = document.createElement('a');
  link.download = 'cyber-ita-wall-' + Date.now() + '.png';
  link.href = screenshotDataUrl;
  link.click();
}

// ===== 动画循环 =====
function animate() {
  requestAnimationFrame(animate);

  // 轻微的灯光浮动效果
  const time = Date.now() * 0.001;
  if (fillLight) {
    fillLight.intensity = 0.6 + Math.sin(time * 1.5) * 0.2;
  }
  if (rimLight) {
    rimLight.intensity = 0.5 + Math.cos(time * 1.2) * 0.15;
  }

  orbitControls.update();
  renderer.render(scene, camera);
}

// ===== 启动 =====
init();
