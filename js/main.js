// ===== 赛博痛墙 - Three.js 3D 长方体洞洞板系统 =====
(function() {
  'use strict';

  // ========== Three.js 全局对象 ==========
  let scene, camera, renderer, controls;
  let boardMesh;        // 长方体洞洞板
  let itemsGroup;       // 物品组
  const itemMeshes = new Map(); // id -> Three.js mesh

  // ========== 配置 ==========
  const CONFIG = {
    board: {
      width: 800,
      height: 600,
      minWidth: 400,
      minHeight: 300
    },
    holeSpacing: 50,
    holeDiameter: 12,
    snapEnabled: true,
    snapThreshold: 20
  };

  // 物品配置
  const ITEM_CONFIG = {
    badge:    { width: 80,  height: 80,  hasImage: true,  defaultColor: '#ffffff' },
    polaroid: { width: 100, height: 130, hasImage: true,  defaultColor: '#ffffff' },
    card:     { width: 90,  height: 135, hasImage: true,  defaultColor: '#ffffff' },
    stand:    { width: 90,  height: 130, hasImage: true,  defaultColor: '#ffffff' },
    petal:    { width: 40,  height: 40,  hasImage: false, defaultColor: '#ffffff' },
    star:     { width: 40,  height: 40,  hasImage: false, defaultColor: '#ffffff' },
    custom:   { width: 110, height: 110, hasImage: true,  defaultColor: '#ffffff', isCustom: true }
  };

  // ========== 状态 ==========
  const state = {
    items: [],
    selectedItem: null,
    dragging: null,
    dragOffset: { x: 0, y: 0 },
    holePositions: [],
    nextId: 1,
    boardWidth: 800,
    boardHeight: 600,
    boardPosX: 0,
    boardPosY: 0,
    boardThickness: 12,   // 板厚度
    boardColor: '#F5F0F5',
    holeColor: '#E0D8E8',
    holeTransparent: false,
    showHoles: false,
    frame: {
      enabled: true,
      color: '#E0D8E8',
      width: 8
    },
    bgColor: '#ffffff',
    bgImage: null,
    camera: {
      rotateX: 0,
      rotateY: 0,
      zoom: 1
    },
    cameraDragging: null,
    lighting: {
      enabled: true,
      preset: 'natural',
      brightness: 1,
      contrast: 1,
      saturate: 1,
      tint: '#ffffff',
      tintAmount: 0
    }
  };

  // 光效预设配置
  const LIGHT_PRESETS = {
    cyberpunk: { brightness: 1.05, contrast: 1.15, saturate: 1.2, tint: '#C88AEB', tintAmount: 0.2 },
    warm:      { brightness: 1.1,  contrast: 1.05, saturate: 1.1, tint: '#EB8AB8', tintAmount: 0.2 },
    cool:      { brightness: 1.05, contrast: 1.1,  saturate: 0.95,tint: '#8A8CEB', tintAmount: 0.15 },
    neon:      { brightness: 1.15, contrast: 1.3,  saturate: 1.5, tint: '#E78AEB', tintAmount: 0.25 },
    sunset:    { brightness: 1.1,  contrast: 1.1,  saturate: 1.2, tint: '#EB8AB8', tintAmount: 0.25 },
    natural:   { brightness: 1,    contrast: 1,     saturate: 1,    tint: '#ffffff', tintAmount: 0 }
  };

  // ========== DOM 引用 ==========
  const $ = (id) => document.getElementById(id);
  const propertyPanel = $('property-panel');
  const itemsLayer = $('items-layer');

  // ========== 工具函数 ==========
  function uid() { return 'item_' + (state.nextId++); }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function toRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lighten(hex, amount) {
    const { r, g, b } = toRgb(hex);
    return `rgb(${clamp(r + amount, 0, 255)},${clamp(g + amount, 0, 255)},${clamp(b + amount, 0, 255)})`;
  }

  function darken(hex, amount) {
    const { r, g, b } = toRgb(hex);
    return `rgb(${clamp(r - amount, 0, 255)},${clamp(g - amount, 0, 255)},${clamp(b - amount, 0, 255)})`;
  }

  // ========== Three.js 初始化 ==========
  function initThree() {
    const container = $('pegboard-container');
    const canvas = $('three-canvas');

    // 场景
    scene = new THREE.Scene();
    scene.background = null; // 透明，让 CSS 背景显示出来

    // 相机 - 初始角度稍微倾斜，让用户一眼就能看到长方体厚度
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 1, 10000);
    camera.position.set(-400, 250, 1600);
    camera.lookAt(0, 0, 0);

    // 渲染器 - 不使用色调映射，保持颜色纯白
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    // ========== 环境贴图（用于金属反射）==========
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // 生成一个简单的渐变环境贴图（模拟室内环境光照）
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512;
    envCanvas.height = 512;
    const envCtx = envCanvas.getContext('2d');
    // 天空渐变
    const envGrd = envCtx.createLinearGradient(0, 0, 0, 512);
    envGrd.addColorStop(0, '#FFF5F0');      // 顶部：米白（和窗口颜色一致）
    envGrd.addColorStop(0.3, '#FADADD');    // 中上部：粉色格子
    envGrd.addColorStop(0.6, '#E8D8E8');    // 中部：淡紫
    envGrd.addColorStop(1, '#D0C0D8');      // 底部：深一点的紫
    envCtx.fillStyle = envGrd;
    envCtx.fillRect(0, 0, 512, 512);
    // 加几个高光点（模拟光源反射）
    envCtx.fillStyle = 'rgba(255,255,255,0.8)';
    envCtx.beginPath();
    envCtx.arc(128, 80, 60, 0, Math.PI * 2);
    envCtx.fill();
    envCtx.fillStyle = 'rgba(255,245,240,0.6)';
    envCtx.beginPath();
    envCtx.arc(380, 150, 40, 0, Math.PI * 2);
    envCtx.fill();

    const envTexture = new THREE.CanvasTexture(envCanvas);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // 主光源（暖白色，模拟左上方自然光）
    const dirLight = new THREE.DirectionalLight(0xFFF5F0, 1.0);
    dirLight.position.set(300, 400, 500);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // 补光（右侧，粉色调）
    const dirLight2 = new THREE.DirectionalLight(0xFFD8E8, 0.5);
    dirLight2.position.set(-300, 200, 300);
    scene.add(dirLight2);

    // 底光（冷紫色，模拟环境反射）
    const dirLight3 = new THREE.DirectionalLight(0xD8C8F0, 0.3);
    dirLight3.position.set(0, -300, 200);
    scene.add(dirLight3);

    // 物品组
    itemsGroup = new THREE.Group();
    scene.add(itemsGroup);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 600;
    controls.maxDistance = 4000;
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };

    // 创建长方体洞洞板
    createBoard();

    // 窗口大小变化
    window.addEventListener('resize', onWindowResize);

    // 开始渲染循环
    animate();
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  // ========== 创建长方体洞洞板（真正的 BoxGeometry）==========
  let holeCylinders = []; // 存储孔洞内壁圆柱

  function createBoard() {
    // 移除旧的板
    if (boardMesh) {
      scene.remove(boardMesh);
      boardMesh.geometry.dispose();
      if (Array.isArray(boardMesh.material)) {
        boardMesh.material.forEach(m => m.dispose());
      } else {
        boardMesh.material.dispose();
      }
    }
    // 移除旧的孔洞圆柱
    holeCylinders.forEach(cyl => {
      scene.remove(cyl);
      cyl.geometry.dispose();
      cyl.material.dispose();
    });
    holeCylinders = [];

    const w = state.boardWidth;
    const h = state.boardHeight;
    const t = state.boardThickness;

    // 真正的长方体！BoxGeometry(width, height, depth)
    const geometry = new THREE.BoxGeometry(w, h, t);

    // 生成带孔洞的纹理 - 前面和后面都用原色，不做加深处理
    const frontTexture = createBoardTexture(w, h, state.boardColor, true);
    const backTexture = createBoardTexture(w, h, state.boardColor, true); // 后面也同样处理，打穿孔洞

    // 6个面的材质：全部用原色，不做darken/lighten处理
    const baseColor = new THREE.Color(state.boardColor);
    const sideMat = new THREE.MeshBasicMaterial({ color: baseColor });
    const topMat = new THREE.MeshBasicMaterial({ color: baseColor });
    const bottomMat = new THREE.MeshBasicMaterial({ color: baseColor });
    const frontMat = new THREE.MeshBasicMaterial({ map: frontTexture, transparent: true });
    const backMat = new THREE.MeshBasicMaterial({ map: backTexture, transparent: true });

    const materials = [
      sideMat,    // right
      sideMat,    // left
      topMat,     // top
      bottomMat,  // bottom
      frontMat,   // front
      backMat     // back
    ];

    boardMesh = new THREE.Mesh(geometry, materials);
    boardMesh.castShadow = true;
    boardMesh.receiveShadow = true;
    boardMesh.position.set(state.boardPosX, -state.boardPosY, 0);
    scene.add(boardMesh);

    // 如果开启了透明孔洞，创建真正的空心圆柱内壁
    if (state.showHoles && state.holeTransparent) {
      const holeR = CONFIG.holeDiameter / 2;
      const spacing = CONFIG.holeSpacing;
      const startX = spacing;
      const startY = spacing;
      const endX = w - spacing;
      const endY = h - spacing;

      // 孔洞内壁颜色 - 比板面稍深
      const innerColor = new THREE.Color(darken(state.boardColor, 15));

      for (let y = startY; y <= endY; y += spacing) {
        for (let x = startX; x <= endX; x += spacing) {
          // 创建空心圆柱（只有侧面，没有上下底）
          const cylGeom = new THREE.CylinderGeometry(holeR, holeR, t, 24, 1, true);
          const cylMat = new THREE.MeshBasicMaterial({ color: innerColor, side: THREE.DoubleSide });
          const cyl = new THREE.Mesh(cylGeom, cylMat);

          // 位置转换：板子坐标系(左上原点) -> Three.js坐标系(中心原点)
          const threeX = x - w / 2;
          const threeY = h / 2 - y;
          cyl.position.set(
            state.boardPosX + threeX,
            -state.boardPosY + threeY,
            0
          );
          cyl.rotation.x = Math.PI / 2; // 圆柱横向放置，沿Z轴方向
          scene.add(cyl);
          holeCylinders.push(cyl);
        }
      }
    }
  }

  // 生成洞洞板纹理（带孔洞效果）
  function createBoardTexture(w, h, color, withHoles) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);

    // 绘制孔洞
    if (withHoles && state.showHoles) {
      const spacing = CONFIG.holeSpacing;
      const holeR = CONFIG.holeDiameter / 2;
      const startX = spacing;
      const startY = spacing;
      const endX = w - spacing;
      const endY = h - spacing;

      for (let y = startY; y <= endY; y += spacing) {
        for (let x = startX; x <= endX; x += spacing) {
          if (state.holeTransparent) {
            // 透明：完全擦除
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, holeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            // 不透明：绘制带立体感的孔洞
            const gradient = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, holeR);
            gradient.addColorStop(0, lighten(state.holeColor, 20));
            gradient.addColorStop(1, darken(state.holeColor, 20));
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, holeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(92,58,122,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    // 外框
    if (state.frame.enabled && state.frame.width > 0) {
      ctx.strokeStyle = state.frame.color;
      ctx.lineWidth = state.frame.width;
      ctx.strokeRect(state.frame.width / 2, state.frame.width / 2,
        w - state.frame.width, h - state.frame.width);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // 更新孔位信息
  function generateHoles() {
    state.holePositions = [];
    const spacing = CONFIG.holeSpacing;
    const startX = spacing;
    const startY = spacing;
    const endX = state.boardWidth - spacing;
    const endY = state.boardHeight - spacing;

    for (let y = startY; y <= endY; y += spacing) {
      for (let x = startX; x <= endX; x += spacing) {
        state.holePositions.push({ x, y });
      }
    }

    // 重新生成板子纹理
    createBoard();
  }

  // ========== 洞洞板设置 ==========
  function updateBoardSize() {
    CONFIG.board.width = state.boardWidth;
    CONFIG.board.height = state.boardHeight;
    generateHoles();
  }

  function updateBoardPosition() {
    if (boardMesh) {
      boardMesh.position.set(state.boardPosX, -state.boardPosY, 0);
    }
  }

  function updateBoardThickness() {
    createBoard();
  }

  function setBoardThickness(t) {
    state.boardThickness = clamp(parseInt(t), 5, 100);
    updateBoardThickness();
  }

  function setBoardWidth(w) {
    state.boardWidth = clamp(parseInt(w), CONFIG.board.minWidth, 1600);
    updateBoardSize();
    // 重新吸附所有物品
    state.items.forEach(item => {
      const snapped = snapToHole(item.x, item.y);
      item.x = snapped.x;
      item.y = snapped.y;
      updateItemMesh(item);
    });
  }

  function setBoardHeight(h) {
    state.boardHeight = clamp(parseInt(h), CONFIG.board.minHeight, 1000);
    updateBoardSize();
    state.items.forEach(item => {
      const snapped = snapToHole(item.x, item.y);
      item.x = snapped.x;
      item.y = snapped.y;
      updateItemMesh(item);
    });
  }

  function setBoardPosX(x) {
    state.boardPosX = parseInt(x);
    updateBoardPosition();
  }

  function setBoardPosY(y) {
    state.boardPosY = parseInt(y);
    updateBoardPosition();
  }

  function setBoardColor(color) {
    state.boardColor = color;
    createBoard();
  }

  function setHoleColor(color) {
    state.holeColor = color;
    createBoard();
  }

  function setHoleSpacing(spacing) {
    CONFIG.holeSpacing = spacing;
    generateHoles();
    state.items.forEach(item => {
      const snapped = snapToHole(item.x, item.y);
      item.x = snapped.x;
      item.y = snapped.y;
      updateItemMesh(item);
    });
  }

  function setHoleTransparent(enabled) {
    state.holeTransparent = enabled;
    createBoard();
  }

  function setShowHoles(show) {
    state.showHoles = show;
    createBoard();
    document.querySelectorAll('.holes-settings').forEach(el => {
      if (show) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  // ========== 外框设置 ==========
  function updateFrameStyle() {
    createBoard();
    document.querySelectorAll('.frame-settings').forEach(el => {
      if (state.frame.enabled) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function setFrameEnabled(enabled) {
    state.frame.enabled = enabled;
    updateFrameStyle();
  }

  function setFrameColor(color) {
    state.frame.color = color;
    updateFrameStyle();
  }

  function setFrameWidth(width) {
    state.frame.width = width;
    updateFrameStyle();
  }

  // ========== 背景设置 ==========
  function applyBgStyle() {
    if (state.bgImage) {
      document.body.style.backgroundImage = `url(${state.bgImage})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundRepeat = '';
      document.body.style.backgroundColor = state.bgColor;
    }
  }

  function setBgColor(color) {
    state.bgColor = color;
    if (!state.bgImage) {
      document.body.style.backgroundColor = color;
    }
  }

  function setBgImage(imageUrl) {
    state.bgImage = imageUrl;
    applyBgStyle();
  }

  function clearBgImage() {
    state.bgImage = null;
    applyBgStyle();
  }

  // ========== 吸附功能 ==========
  function findNearestHole(x, y) {
    let nearest = null;
    let minDist = Infinity;
    for (const hole of state.holePositions) {
      const d = Math.hypot(hole.x - x, hole.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = hole;
      }
    }
    return { hole: nearest, distance: minDist };
  }

  function snapToHole(x, y) {
    if (!CONFIG.snapEnabled) return { x, y };
    const { hole, distance } = findNearestHole(x, y);
    if (hole && distance <= CONFIG.snapThreshold) {
      return { x: hole.x, y: hole.y, snapped: true, hole };
    }
    return { x, y };
  }

  // ========== 物品纹理生成 ==========
  function createItemTexture(itemData) {
    const cfg = itemData.config;
    const baseW = itemData.width || cfg.width;
    const baseH = itemData.height || cfg.height;
    const w = baseW * itemData.scale;
    const h = baseH * itemData.scale;

    const canvas = document.createElement('canvas');
    canvas.width = w * 2; // 2x 高清
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    switch (itemData.type) {
      case 'badge':
        // 圆形
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (itemData.imageUrl) {
          drawImageCover(ctx, itemData.imageUrl, 0, 0, w, h);
        } else {
          const grd = ctx.createRadialGradient(w * 0.3, h * 0.3, 2, w / 2, h / 2, w / 2);
          grd.addColorStop(0, lighten(itemData.color, 30));
          grd.addColorStop(0.5, itemData.color);
          grd.addColorStop(1, darken(itemData.color, 20));
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();
        // 高光
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(w * 0.35, h * 0.3, w * 0.18, h * 0.12, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        ctx.restore();
        break;

      case 'polaroid':
        // 拍立得：白边 + 照片
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        const photoH = h * 0.78;
        ctx.fillStyle = '#f5ecf5';
        ctx.fillRect(6, 6, w - 12, photoH - 6);
        if (itemData.imageUrl) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(6, 6, w - 12, photoH - 6);
          ctx.clip();
          drawImageCover(ctx, itemData.imageUrl, 6, 6, w - 12, photoH - 6);
          ctx.restore();
        }
        break;

      case 'card':
      case 'stand':
        // 圆角矩形
        roundRect(ctx, 0, 0, w, h, 10);
        if (itemData.imageUrl) {
          ctx.save();
          roundRect(ctx, 0, 0, w, h, 10);
          ctx.clip();
          drawImageCover(ctx, itemData.imageUrl, 0, 0, w, h);
          ctx.restore();
        } else {
          const grd = ctx.createLinearGradient(0, 0, w, h);
          grd.addColorStop(0, lighten(itemData.color, 20));
          grd.addColorStop(1, itemData.color);
          ctx.fillStyle = grd;
          roundRect(ctx, 0, 0, w, h, 10);
          ctx.fill();
        }
        // 边框
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        roundRect(ctx, 0, 0, w, h, 10);
        ctx.stroke();
        // 立牌底座
        if (itemData.type === 'stand') {
          ctx.fillStyle = '#5C3A7A';
          roundRect(ctx, w * 0.175, h - 6, w * 0.65, 12, 3);
          ctx.fill();
        }
        break;

      case 'petal':
        drawPetal(ctx, w, h, itemData.color);
        break;

      case 'star':
        drawStar(ctx, w, h, itemData.color);
        break;

      case 'custom':
        if (itemData.imageUrl) {
          drawImageContain(ctx, itemData.imageUrl, 0, 0, w, h);
        } else {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#5C3A7A';
          ctx.lineWidth = 3;
          roundRect(ctx, 0, 0, w, h, 10);
          ctx.stroke();
          ctx.fillStyle = 'rgba(92,58,122,0.3)';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('＋', w / 2, h / 2);
        }
        break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function drawImageCover(ctx, imageSrc, x, y, w, h) {
    const img = new Image();
    img.onload = () => {
      const imgRatio = img.width / img.height;
      const targetRatio = w / h;
      let sx, sy, sw, sh;
      if (imgRatio > targetRatio) {
        sh = img.height;
        sw = sh * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    };
    img.src = imageSrc;
    if (img.complete && img.naturalWidth > 0) {
      img.onload();
    }
  }

  function drawImageContain(ctx, imageSrc, x, y, w, h) {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(w / img.width, h / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    };
    img.src = imageSrc;
    if (img.complete && img.naturalWidth > 0) {
      img.onload();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  function drawPetal(ctx, w, h, color) {
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.35, w * 0.125, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = darken(color, 30);
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStar(ctx, w, h, color) {
    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(w, h) * 0.45;
    const innerR = outerR * 0.43;
    ctx.fillStyle = color;
    ctx.strokeStyle = darken(color, 20);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ========== 创建物品 ==========
  function createItem(type, options = {}) {
    const cfg = ITEM_CONFIG[type];
    if (!cfg) return null;

    const id = uid();
    const itemData = {
      id,
      type,
      x: options.x || (CONFIG.board.width / 2),
      y: options.y || (CONFIG.board.height / 2),
      scale: options.scale || 1,
      rotation: options.rotation || 0,
      width: options.width || null,
      height: options.height || null,
      color: options.color || cfg.defaultColor,
      imageUrl: options.imageUrl || null,
      name: options.name || '',
      showName: options.showName !== undefined ? options.showName : true,
      shadow: {
        enabled: options.shadow?.enabled !== undefined ? options.shadow.enabled : true,
        offsetX: options.shadow?.offsetX || 0,
        offsetY: options.shadow?.offsetY || 4,
        blur: options.shadow?.blur || 12,
        spread: options.shadow?.spread || 0,
        color: options.shadow?.color || 'rgba(0, 0, 0, 0.5)',
        opacity: options.shadow?.opacity !== undefined ? options.shadow.opacity : 0.7
      },
      config: cfg
    };

    if (!options.skipSnap) {
      const snapped = snapToHole(itemData.x, itemData.y);
      itemData.x = snapped.x;
      itemData.y = snapped.y;
    }

    state.items.push(itemData);
    createItemMesh(itemData);
    return itemData;
  }

  // 创建徽章几何体（中间厚、边缘圆弧缩小的真实徽章形状）
  function createBadgeGeometry(radius, thickness) {
    const points = [];
    const segments = 32;
    const edgeShrink = thickness * 0.45;

    // 上半部分轮廓
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = radius * t;
      const thicknessFactor = Math.cos(t * Math.PI / 2);
      const y = (thickness * 0.5) * thicknessFactor;

      if (t > 0.85) {
        const edgeT = (t - 0.85) / 0.15;
        const rounded = 1 - Math.sin(edgeT * Math.PI / 2);
        points.push(new THREE.Vector2(r, y * rounded - edgeShrink * edgeT));
      } else {
        points.push(new THREE.Vector2(r, y));
      }
    }

    // 下半部分（对称）
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const r = radius * t;
      const thicknessFactor = Math.cos(t * Math.PI / 2);
      const y = -(thickness * 0.5) * thicknessFactor;

      if (t > 0.85) {
        const edgeT = (t - 0.85) / 0.15;
        const rounded = 1 - Math.sin(edgeT * Math.PI / 2);
        points.push(new THREE.Vector2(r, y * rounded + edgeShrink * edgeT));
      } else {
        points.push(new THREE.Vector2(r, y));
      }
    }

    return new THREE.LatheGeometry(points, 64);
  }

  // 创建徽章精细纹理（像素级复刻echodraw风格：细金属卷边+整枚穹顶高光）
  function createBadgeCanvasTexture(itemData) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;   // 徽章总半径

    const lightX = cx - r * 0.35;
    const lightY = cy - r * 0.4;

    // ========== 1. 最外圈：金属卷边的深色基底 ==========
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const rimBase = ctx.createRadialGradient(lightX, lightY, r * 0.1, cx, cy, r);
    rimBase.addColorStop(0.85, 'rgba(80, 60, 95, 0)');
    rimBase.addColorStop(0.92, '#3A2848');
    rimBase.addColorStop(0.97, '#2A1835');
    rimBase.addColorStop(1,    '#1A0E22');
    ctx.fillStyle = rimBase;
    ctx.fill();

    // ========== 2. 主体区域底色（在图片加载前显示） ==========
    // 先画一个非常细的金属内圈轮廓
    const metalRimWidth = r * 0.055;  // 金属卷边宽度：5.5%
    const contentR = r - metalRimWidth;

    ctx.beginPath();
    ctx.arc(cx, cy, contentR, 0, Math.PI * 2);
    const contentBase = ctx.createRadialGradient(lightX, lightY, r * 0.05, cx, cy, contentR);
    contentBase.addColorStop(0, '#F8F4F8');
    contentBase.addColorStop(0.4, '#E8E0E8');
    contentBase.addColorStop(0.75, '#D0C8D0');
    contentBase.addColorStop(1, '#B8B0B8');
    ctx.fillStyle = contentBase;
    ctx.fill();

    // ========== 3. 细金属卷边的光泽（1-2px 亮边） ==========
    ctx.beginPath();
    ctx.arc(cx, cy, r - metalRimWidth * 0.4, 0, Math.PI * 2);
    const rimShine = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rimShine.addColorStop(0,    'rgba(230, 220, 240, 0.85)');
    rimShine.addColorStop(0.15, 'rgba(210, 200, 225, 0.5)');
    rimShine.addColorStop(0.3,  'rgba(180, 170, 200, 0.2)');
    rimShine.addColorStop(0.5,  'rgba(150, 140, 175, 0.05)');
    rimShine.addColorStop(0.7,  'rgba(120, 110, 150, 0.05)');
    rimShine.addColorStop(0.85, 'rgba(90, 80, 120, 0.15)');
    rimShine.addColorStop(1,    'rgba(60, 50, 90, 0.3)');
    ctx.strokeStyle = rimShine;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ========== 4. 图片内容 ==========
    const drawImageContent = (imgEl) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, contentR - 0.5, 0, Math.PI * 2);
      ctx.clip();

      const iw = imgEl.naturalWidth;
      const ih = imgEl.naturalHeight;
      const iRatio = iw / ih;
      let dw, dh, dx, dy;
      if (iRatio > 1) {
        dh = contentR * 2;
        dw = dh * iRatio;
      } else {
        dw = contentR * 2;
        dh = dw / iRatio;
      }
      dx = cx - dw / 2;
      dy = cy - dh / 2;
      ctx.drawImage(imgEl, dx, dy, dw, dh);

      // 图片上的微弱色偏（模拟玻璃下的效果）
      const tint = ctx.createRadialGradient(
        lightX, lightY, contentR * 0.1,
        cx, cy, contentR
      );
      tint.addColorStop(0,   'rgba(255, 250, 255, 0.04)');
      tint.addColorStop(0.5, 'rgba(245, 240, 250, 0.02)');
      tint.addColorStop(1,   'rgba(15, 10, 30, 0.15)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();
    };

    if (itemData.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        drawImageContent(img);
        drawGlassHighlights();
        tex.needsUpdate = true;
      };
      img.onerror = () => {
        drawDefaultEnamel(ctx, cx, cy, contentR, itemData.color);
        drawGlassHighlights();
        tex.needsUpdate = true;
      };
      img.src = itemData.imageUrl;

      if (img.complete && img.naturalWidth > 0) {
        drawImageContent(img);
      } else {
        drawDefaultEnamel(ctx, cx, cy, contentR, itemData.color);
      }
    } else {
      drawDefaultEnamel(ctx, cx, cy, contentR, itemData.color);
    }

    // ========== 5. 玻璃穹顶高光系统（覆盖整枚徽章） ==========
    function drawGlassHighlights() {

      // 5.1 大面积顶面柔和高光（穹顶漫反射）
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.clip();
      const topGloss = ctx.createRadialGradient(
        cx - r * 0.2, cy - r * 0.45, r * 0.02,
        cx - r * 0.2, cy - r * 0.45, r * 0.9
      );
      topGloss.addColorStop(0,    'rgba(255, 255, 255, 0.3)');
      topGloss.addColorStop(0.1,  'rgba(255, 255, 255, 0.22)');
      topGloss.addColorStop(0.22, 'rgba(255, 255, 255, 0.14)');
      topGloss.addColorStop(0.4,  'rgba(255, 255, 255, 0.06)');
      topGloss.addColorStop(0.65, 'rgba(255, 255, 255, 0.02)');
      topGloss.addColorStop(1,    'rgba(255, 255, 255, 0)');
      ctx.fillStyle = topGloss;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // 5.2 左上弧形锐利高光条（echodraw标志性的玻璃反射）
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        cx - r * 0.15, cy - r * 0.3,
        r * 0.4, r * 0.18,
        -0.42, 0, Math.PI * 2
      );
      const sharpHi = ctx.createRadialGradient(
        cx - r * 0.18, cy - r * 0.35, r * 0.02,
        cx - r * 0.15, cy - r * 0.3, r * 0.4
      );
      sharpHi.addColorStop(0,    'rgba(255, 255, 255, 0.65)');
      sharpHi.addColorStop(0.18, 'rgba(255, 255, 255, 0.42)');
      sharpHi.addColorStop(0.4,  'rgba(255, 255, 255, 0.15)');
      sharpHi.addColorStop(0.7,  'rgba(255, 255, 255, 0.03)');
      sharpHi.addColorStop(1,    'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sharpHi;
      ctx.fill();
      ctx.restore();

      // 5.3 最顶端细条形点光源反射
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        cx - r * 0.08, cy - r * 0.43,
        r * 0.14, r * 0.05,
        -0.25, 0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fill();
      ctx.restore();

      // 5.4 右下冷色环境反光
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
      ctx.clip();
      const bottomReflect = ctx.createRadialGradient(
        cx + r * 0.3, cy + r * 0.4, r * 0.05,
        cx + r * 0.3, cy + r * 0.4, r * 0.7
      );
      bottomReflect.addColorStop(0,   'rgba(140, 160, 210, 0.1)');
      bottomReflect.addColorStop(0.4, 'rgba(120, 140, 190, 0.04)');
      bottomReflect.addColorStop(1,   'rgba(80, 100, 160, 0)');
      ctx.fillStyle = bottomReflect;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // 5.5 边缘暗角（让中间显得鼓起来，有穹顶感）
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const vignette = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
      vignette.addColorStop(0,   'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.75,'rgba(0, 0, 0, 0.03)');
      vignette.addColorStop(0.9, 'rgba(0, 0, 0, 0.12)');
      vignette.addColorStop(1,   'rgba(0, 0, 0, 0.25)');
      ctx.fillStyle = vignette;
      ctx.fill();
      ctx.restore();
    }

    drawGlassHighlights();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // 绘制默认珐琅效果（无图片时）
  function drawDefaultEnamel(ctx, cx, cy, r, color) {
    const baseColor = color || '#ffffff';
    // 径向渐变模拟珐琅质感
    const grd = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, r * 0.1, cx, cy, r);
    grd.addColorStop(0, lighten(baseColor, 35));
    grd.addColorStop(0.3, lighten(baseColor, 15));
    grd.addColorStop(0.6, baseColor);
    grd.addColorStop(1, darken(baseColor, 20));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }

  // 创建金属颜色贴图（用于PBR材质的albedo）
  function createMetalColorMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 镀银/镍色金属基底（略带暖调）
    const grd = ctx.createLinearGradient(0, 0, 512, 512);
    grd.addColorStop(0, '#F0E8F0');    // 亮银白
    grd.addColorStop(0.3, '#D8D0D8');   // 银灰
    grd.addColorStop(0.6, '#C8BFC8');   // 暖银
    grd.addColorStop(1, '#B0A8B0');     // 暗银

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 徽章PBR纹理缓存（只创建一次）
  let badgeMetalColorMap = null;
  let badgeMetalRoughnessMap = null;

  function createItemMesh(itemData) {
    const cfg = itemData.config;
    const baseW = itemData.width || cfg.width;
    const baseH = itemData.height || cfg.height;
    const w = baseW * itemData.scale;
    const h = baseH * itemData.scale;

    const threeX = itemData.x - CONFIG.board.width / 2;
    const threeY = CONFIG.board.height / 2 - itemData.y;
    const baseZ = state.boardThickness / 2 + 1;

    let mesh;

    if (itemData.type === 'badge') {
      // ===== 徽章：平面 + Canvas精细纹理（像素级复刻echodraw），使用StandardMaterial支持光照阴影 =====
      const geometry = new THREE.PlaneGeometry(w, h);
      const texture = createBadgeCanvasTexture(itemData);

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.3
      });

      mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { itemId: itemData.id };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // 徽章稍微浮起一点，使其能在板子上投下可见阴影
      mesh.position.set(threeX, threeY, baseZ + 25);
      mesh.rotation.z = -itemData.rotation * Math.PI / 180;
    } else {
      // ===== 其他物品：平面 =====
      const geometry = new THREE.PlaneGeometry(w, h);
      const texture = createItemTexture(itemData);

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { itemId: itemData.id };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(threeX, threeY, baseZ);
      mesh.rotation.z = -itemData.rotation * Math.PI / 180;
    }

    itemsGroup.add(mesh);
    itemMeshes.set(itemData.id, mesh);
  }

  function updateItemMesh(itemData) {
    const mesh = itemMeshes.get(itemData.id);
    if (!mesh) return;

    const cfg = itemData.config;
    const baseW = itemData.width || cfg.width;
    const baseH = itemData.height || cfg.height;
    const w = baseW * itemData.scale;
    const h = baseH * itemData.scale;
    const threeX = itemData.x - CONFIG.board.width / 2;
    const threeY = CONFIG.board.height / 2 - itemData.y;
    const baseZ = state.boardThickness / 2 + 1;

    if (itemData.type === 'badge') {
      // ===== 徽章更新：平面 + Canvas精细纹理，使用StandardMaterial =====
      const newTexture = createBadgeCanvasTexture(itemData);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.map = newTexture;
      mesh.material.needsUpdate = true;

      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(w, h);
      mesh.position.set(threeX, threeY, baseZ + 25);
      mesh.rotation.z = -itemData.rotation * Math.PI / 180;
    } else {
      // ===== 平面物品更新 =====
      const newTexture = createItemTexture(itemData);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.map = newTexture;
      mesh.material.needsUpdate = true;

      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(w, h);
      mesh.position.set(threeX, threeY, baseZ);
      mesh.rotation.z = -itemData.rotation * Math.PI / 180;
    }
  }

  function removeItemMesh(itemData) {
    const mesh = itemMeshes.get(itemData.id);
    if (mesh) {
      itemsGroup.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
      itemMeshes.delete(itemData.id);
    }
  }

  // ========== 图片按形状裁剪 ==========
  function cropImageToShape(imageSrc, shape, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        switch (shape) {
          case 'badge':
            ctx.save();
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            drawImageCoverOnCtx(ctx, img, width, height);
            ctx.restore();
            break;
          case 'polaroid':
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            const photoH = height * 0.78;
            ctx.save();
            ctx.beginPath();
            ctx.rect(6, 6, width - 12, photoH - 6);
            ctx.closePath();
            ctx.clip();
            drawImageCoverOnCtx(ctx, img, width - 12, photoH - 6, 6, 6);
            ctx.restore();
            break;
          case 'card':
          case 'stand':
            ctx.save();
            roundRect(ctx, 0, 0, width, height, 10);
            ctx.clip();
            drawImageCoverOnCtx(ctx, img, width, height);
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 4;
            roundRect(ctx, 0, 0, width, height, 10);
            ctx.stroke();
            break;
          default:
            drawImageCoverOnCtx(ctx, img, width, height);
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageSrc;
    });
  }

  function drawImageCoverOnCtx(ctx, img, w, h, offsetX = 0, offsetY = 0) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > targetRatio) {
      sh = img.height;
      sw = sh * targetRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / targetRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, offsetX, offsetY, w, h);
  }

  // ========== 抠图处理 ==========
  function showBgRemovalProgress() {
    if (document.querySelector('.bg-removal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'bg-removal-overlay';
    overlay.innerHTML = `
      <div class="bg-removal-modal">
        <h3>AI 智能抠图中</h3>
        <div class="status" id="bg-removal-status">正在初始化 AI 引擎...</div>
        <div class="bg-removal-progress">
          <div class="bg-removal-progress-bar" id="bg-removal-bar"></div>
        </div>
        <div class="bg-removal-percent" id="bg-removal-percent">0%</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateBgRemovalProgress(percent, status) {
    const bar = document.getElementById('bg-removal-bar');
    const pct = document.getElementById('bg-removal-percent');
    const st = document.getElementById('bg-removal-status');
    if (bar) bar.style.width = percent + '%';
    if (pct) pct.textContent = Math.round(percent) + '%';
    if (st && status) st.textContent = status;
  }

  function hideBgRemovalProgress() {
    document.querySelectorAll('.bg-removal-overlay').forEach(el => el.remove());
  }

  async function removeBgFromImage(imageSrc) {
    if (!window.removeBackground) {
      updateBgRemovalProgress(5, '正在加载 AI 抠图引擎...');
      await new Promise((resolve) => {
        if (window.removeBackground) return resolve();
        document.addEventListener('bg-removal-ready', resolve, { once: true });
        setTimeout(resolve, 15000);
      });
    }
    if (!window.removeBackground) {
      throw new Error('AI 抠图引擎加载失败，请刷新页面重试');
    }

    updateBgRemovalProgress(10, '正在下载 AI 模型（首次使用约 80MB）...');
    const resultBlob = await window.removeBackground(imageSrc, {
      progress: (key, current, total) => {
        const pct = total > 0 ? (current / total) * 100 : 0;
        const downloadPct = 10 + (pct * 0.5);
        updateBgRemovalProgress(downloadPct, `正在加载 ${key}...`);
      },
      output: { format: 'image/png', type: 'foreground' }
    });

    updateBgRemovalProgress(70, '正在进行 AI 智能抠图...');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
    updateBgRemovalProgress(100, '抠图完成！');
    return dataUrl;
  }

  // ========== 图片裁剪（Cropper.js 交互式） ==========
  let cropperInstance = null;
  let cropCallback = null;
  let currentCropShape = 'free';
  let currentCropItemType = null;

  const CROP_ASPECT_RATIOS = {
    'free': NaN,
    '1:1': 1,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    'badge': 1,
    'polaroid': 100 / 130,
    'card': 90 / 135
  };

  function openCropModal(imageUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const modal = $('crop-modal');
      const imgEl = $('crop-image');
      const shapeSel = $('crop-shape');
      const container = document.querySelector('.crop-modal-content');

      // 设置初始形状
      currentCropShape = options.initialShape || 'free';
      currentCropItemType = options.itemType || null;
      shapeSel.value = currentCropShape;
      updateCropShapeClass(currentCropShape);

      // 设置回调
      cropCallback = { resolve, reject };

      // 加载图片
      imgEl.src = imageUrl;

      // 显示弹窗
      modal.style.display = 'flex';

      // 图片加载后初始化 Cropper
      imgEl.onload = () => {
        if (cropperInstance) {
          cropperInstance.destroy();
          cropperInstance = null;
        }

        const aspectRatio = CROP_ASPECT_RATIOS[currentCropShape] || NaN;

        cropperInstance = new Cropper(imgEl, {
          aspectRatio: aspectRatio,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.8,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          background: true,
          responsive: true,
          ready: function() {
            // 初始加载完成
          }
        });
      };

      imgEl.onerror = (e) => {
        reject(new Error('图片加载失败'));
        closeCropModal();
      };
    });
  }

  function closeCropModal() {
    const modal = $('crop-modal');
    const imgEl = $('crop-image');

    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    modal.style.display = 'none';
    imgEl.src = '';
    cropCallback = null;
  }

  function updateCropShapeClass(shape) {
    const modal = document.querySelector('.crop-modal-content');
    // 清除所有形状类
    modal.classList.remove(
      'crop-shape-badge',
      'crop-shape-polaroid',
      'crop-shape-card'
    );
    // 添加对应形状类
    if (shape === 'badge' || shape === 'polaroid' || shape === 'card') {
      modal.classList.add('crop-shape-' + shape);
    }
  }

  function setCropAspectRatio(shape) {
    if (!cropperInstance) return;
    const ratio = CROP_ASPECT_RATIOS[shape] || NaN;
    cropperInstance.setAspectRatio(ratio);
    updateCropShapeClass(shape);
  }

  function confirmCrop() {
    if (!cropperInstance || !cropCallback) return;

    const shape = currentCropShape;

    // 获取裁剪后的 canvas
    const croppedCanvas = cropperInstance.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });

    if (!croppedCanvas) {
      cropCallback.reject(new Error('裁剪失败'));
      closeCropModal();
      return;
    }

    let finalCanvas = croppedCanvas;

    // 对于特殊形状，需要应用遮罩
    if (shape === 'badge') {
      finalCanvas = applyCircleMask(croppedCanvas);
    } else if (shape === 'polaroid') {
      finalCanvas = applyPolaroidMask(croppedCanvas);
    } else if (shape === 'card') {
      finalCanvas = applyRoundedMask(croppedCanvas, 20);
    }

    const resultDataUrl = finalCanvas.toDataURL('image/png');
    cropCallback.resolve(resultDataUrl);
    closeCropModal();
  }

  function applyCircleMask(sourceCanvas) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 圆形裁剪
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return canvas;
  }

  function applyPolaroidMask(sourceCanvas) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 白色底（拍立得边框）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 照片区域
    const photoH = h * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * 0.04, h * 0.04, w * 0.92, photoH - h * 0.04);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0, w, h);
    ctx.restore();

    return canvas;
  }

  function applyRoundedMask(sourceCanvas, radius) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 圆角矩形裁剪
    ctx.save();
    ctx.beginPath();
    const r = radius;
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    // 白色边框
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(6, w * 0.025);
    ctx.beginPath();
    const r2 = r;
    ctx.moveTo(r2, 0);
    ctx.lineTo(w - r2, 0);
    ctx.quadraticCurveTo(w, 0, w, r2);
    ctx.lineTo(w, h - r2);
    ctx.quadraticCurveTo(w, h, w - r2, h);
    ctx.lineTo(r2, h);
    ctx.quadraticCurveTo(0, h, 0, h - r2);
    ctx.lineTo(0, r2);
    ctx.quadraticCurveTo(0, 0, r2, 0);
    ctx.closePath();
    ctx.stroke();

    return canvas;
  }

  // ========== 选中 / 属性面板 ==========
  function selectItem(itemData) {
    if (state.selectedItem) {
      const oldMesh = itemMeshes.get(state.selectedItem.id);
      if (oldMesh) {
        // 恢复原位置
        const oldItem = state.selectedItem;
        const oldCfg = oldItem.config;
        const oldW = (oldItem.width || oldCfg.width) * oldItem.scale;
        const oldH = (oldItem.height || oldCfg.height) * oldItem.scale;
        oldMesh.position.z = state.boardThickness / 2 + 1;
        oldMesh.scale.set(1, 1, 1);
      }
    }

    state.selectedItem = itemData;
    const mesh = itemMeshes.get(itemData.id);
    if (mesh) {
      // 选中效果：稍微往前突出 + 轻微放大
      mesh.position.z = state.boardThickness / 2 + 20;
      mesh.scale.set(1.05, 1.05, 1.05);
    }

    // 置顶
    const idx = state.items.indexOf(itemData);
    if (idx > -1) {
      state.items.splice(idx, 1);
      state.items.push(itemData);
    }

    showPropertyPanel(itemData);
  }

  function deselectItem() {
    if (state.selectedItem) {
      const mesh = itemMeshes.get(state.selectedItem.id);
      if (mesh) {
        // 恢复原位置
        mesh.position.z = state.boardThickness / 2 + 1;
        mesh.scale.set(1, 1, 1);
      }
    }
    state.selectedItem = null;
    propertyPanel.style.display = 'none';
  }

  function showPropertyPanel(itemData) {
    propertyPanel.style.display = 'block';
    const cfg = itemData.config;

    $('item-name').value = itemData.name || '';
    $('name-toggle').checked = itemData.showName;

    $('color-setting').style.display = cfg.hasImage || itemData.type === 'petal' || itemData.type === 'star' ? 'flex' : 'none';
    $('item-color').value = rgbToHex(itemData.color);

    const cropTypes = ['badge', 'polaroid', 'card', 'stand'];
    const showCrop = cropTypes.includes(itemData.type);
    $('crop-setting').style.display = showCrop ? 'flex' : 'none';
    const cropBtn = $('btn-crop-image');
    if (cropBtn) {
      if (itemData.imageUrl) {
        cropBtn.disabled = false;
        cropBtn.textContent = '按当前形状裁剪';
      } else {
        cropBtn.disabled = true;
        cropBtn.textContent = '请先上传图片';
      }
    }

    $('item-scale').value = itemData.scale;

    const showSize = itemData.type === 'card';
    $('size-setting').style.display = showSize ? 'flex' : 'none';
    $('height-setting').style.display = showSize ? 'flex' : 'none';
    if (showSize) {
      $('item-width').value = itemData.width || itemData.config.width;
      $('item-height').value = itemData.height || itemData.config.height;
    }

    $('item-rotation').value = itemData.rotation;

    const s = itemData.shadow || {};
    $('shadow-toggle').checked = s.enabled !== false;
    $('shadow-color').value = rgbToHex(s.color || '#000000');
    $('shadow-opacity').value = s.opacity !== undefined ? s.opacity : 0.7;
    $('shadow-offsety').value = s.offsetY !== undefined ? s.offsetY : 4;
    $('shadow-blur').value = s.blur !== undefined ? s.blur : 12;

    document.querySelectorAll('.shadow-settings').forEach(el => {
      if (s.enabled !== false) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function rgbToHex(color) {
    if (color.startsWith('#')) return color;
    const match = color.match(/\d+/g);
    if (!match) return '#ffffff';
    return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // ========== 物品操作 ==========
  function deleteSelected() {
    if (!state.selectedItem) return;
    const item = state.selectedItem;
    removeItemMesh(item);
    state.items = state.items.filter(i => i.id !== item.id);
    deselectItem();
  }

  function duplicateSelected() {
    if (!state.selectedItem) return;
    const src = state.selectedItem;
    const newItem = createItem(src.type, {
      x: src.x + 30,
      y: src.y + 30,
      scale: src.scale,
      rotation: src.rotation,
      width: src.width,
      height: src.height,
      color: src.color,
      imageUrl: src.imageUrl
    });
    if (newItem) selectItem(newItem);
  }

  async function applyImageToSelected(imageUrl, doCrop = true) {
    if (!state.selectedItem) return;
    const item = state.selectedItem;
    const type = item.type;

    if (doCrop && (type === 'badge' || type === 'polaroid' || type === 'card' || type === 'stand')) {
      // 使用交互式裁剪
      try {
        const initialShape = type;
        const cropped = await openCropModal(imageUrl, {
          initialShape: initialShape,
          itemType: type
        });
        item.imageUrl = cropped;
      } catch (err) {
        console.warn('图片裁剪取消或失败，使用原图:', err);
        item.imageUrl = imageUrl;
      }
    } else {
      item.imageUrl = imageUrl;
    }

    updateItemMesh(item);
  }

  function updateSelectedColor(color) {
    if (!state.selectedItem) return;
    state.selectedItem.color = color;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedScale(scale) {
    if (!state.selectedItem) return;
    state.selectedItem.scale = scale;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedWidth(width) {
    if (!state.selectedItem) return;
    state.selectedItem.width = width;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedHeight(height) {
    if (!state.selectedItem) return;
    state.selectedItem.height = height;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedRotation(deg) {
    if (!state.selectedItem) return;
    state.selectedItem.rotation = deg;
    updateItemMesh(state.selectedItem);
  }

  // ========== 阴影设置 ==========
  function updateSelectedShadowEnabled(enabled) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.enabled = enabled;
    updateItemMesh(state.selectedItem);
    document.querySelectorAll('.shadow-settings').forEach(el => {
      if (enabled) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function updateSelectedShadowColor(color) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.color = color;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedShadowOpacity(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.opacity = val;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedShadowOffsetY(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.offsetY = val;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedShadowBlur(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.blur = val;
    updateItemMesh(state.selectedItem);
  }

  // ========== 物品命名 ==========
  function updateSelectedName(name) {
    if (!state.selectedItem) return;
    state.selectedItem.name = name;
    updateItemMesh(state.selectedItem);
  }

  function updateSelectedShowName(show) {
    if (!state.selectedItem) return;
    state.selectedItem.showName = show;
    updateItemMesh(state.selectedItem);
  }

  // ========== 光效控制 ==========
  function applyLighting() {
    const l = state.lighting;
    const canvas = $('three-canvas');
    if (!l.enabled) {
      canvas.style.filter = 'none';
      return;
    }
    // 用CSS滤镜实现光效，不影响原色
    const brightness = l.brightness;
    const contrast = l.contrast;
    const saturate = l.saturate;
    const tint = l.tint;
    const tintAmount = l.tintAmount;

    let filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
    if (tintAmount > 0) {
      // 简单实现色调：通过hue-rotate和sepia近似
      const { r, g, b } = toRgb(tint);
      const hue = rgbToHue(r, g, b);
      filter += ` hue-rotate(${hue}deg) sepia(${tintAmount * 0.3})`;
    }
    canvas.style.filter = filter;
  }

  function rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return Math.round(h * 360);
  }

  function setLightPreset(preset) {
    state.lighting.preset = preset;
    if (preset !== 'custom' && LIGHT_PRESETS[preset]) {
      const p = LIGHT_PRESETS[preset];
      state.lighting.brightness = p.brightness;
      state.lighting.contrast = p.contrast;
      state.lighting.saturate = p.saturate;
      state.lighting.tint = p.tint;
      state.lighting.tintAmount = p.tintAmount;
      $('light-brightness').value = p.brightness;
      $('light-contrast').value = p.contrast;
      $('light-saturate').value = p.saturate;
      $('light-tint').value = p.tint;
      $('light-tint-amount').value = p.tintAmount;
    }
    applyLighting();
  }

  function setLightEnabled(enabled) {
    state.lighting.enabled = enabled;
    document.querySelectorAll('.setting-row.light-settings').forEach(el => {
      el.classList.toggle('hidden', !enabled);
    });
    applyLighting();
  }

  function setLightBrightness(v) { state.lighting.brightness = parseFloat(v); state.lighting.preset = 'custom'; $('light-preset').value = 'custom'; applyLighting(); }
  function setLightContrast(v)   { state.lighting.contrast = parseFloat(v);   state.lighting.preset = 'custom'; $('light-preset').value = 'custom'; applyLighting(); }
  function setLightSaturate(v)   { state.lighting.saturate = parseFloat(v);   state.lighting.preset = 'custom'; $('light-preset').value = 'custom'; applyLighting(); }
  function setLightTint(v)       { state.lighting.tint = v;                    state.lighting.preset = 'custom'; $('light-preset').value = 'custom'; applyLighting(); }
  function setLightTintAmount(v) { state.lighting.tintAmount = parseFloat(v);  state.lighting.preset = 'custom'; $('light-preset').value = 'custom'; applyLighting(); }

  // ========== 保存/导入系统 ==========
  const STORAGE_KEY = 'itawall_saves';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function generateCode() {
    let code = '';
    for (let i = 0; i < 16; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  function serializeState(name) {
    return {
      name: name || '未命名布局',
      code: generateCode(),
      createdAt: Date.now(),
      data: {
        items: state.items.map(item => ({
          type: item.type,
          x: item.x,
          y: item.y,
          scale: item.scale,
          rotation: item.rotation,
          width: item.width,
          height: item.height,
          color: item.color,
          imageUrl: item.imageUrl,
          name: item.name,
          showName: item.showName,
          shadow: item.shadow ? { ...item.shadow } : undefined
        })),
        boardWidth: state.boardWidth,
        boardHeight: state.boardHeight,
        boardPosX: state.boardPosX,
        boardPosY: state.boardPosY,
        boardThickness: state.boardThickness,
        boardColor: state.boardColor,
        holeColor: state.holeColor,
        holeTransparent: state.holeTransparent,
        showHoles: state.showHoles,
        frame: { ...state.frame },
        bgColor: state.bgColor,
        bgImage: state.bgImage,
        camera: { ...state.camera },
        lighting: { ...state.lighting },
        holeSpacing: CONFIG.holeSpacing,
        snapEnabled: CONFIG.snapEnabled
      }
    };
  }

  function saveLayout(name) {
    const save = serializeState(name);
    const saves = getSaves();
    saves.unshift(save);
    if (saves.length > 20) saves.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    return save;
  }

  function getSaves() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function findSaveByCode(code) {
    const saves = getSaves();
    return saves.find(s => s.code.toUpperCase() === code.toUpperCase());
  }

  function deleteSave(code) {
    const saves = getSaves().filter(s => s.code !== code);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  }

  function applySaveData(saveData) {
    const d = saveData.data;

    // 清除现有物品
    state.items.forEach(item => removeItemMesh(item));
    state.items = [];
    deselectItem();

    if (d.boardColor !== undefined) { state.boardColor = d.boardColor; $('board-color').value = d.boardColor; }
    if (d.holeColor !== undefined) { state.holeColor = d.holeColor; $('hole-color').value = d.holeColor; }
    if (d.showHoles !== undefined) { state.showHoles = d.showHoles; $('holes-toggle').checked = d.showHoles; }
    if (d.frame !== undefined) { state.frame = { ...state.frame, ...d.frame }; $('frame-toggle').checked = state.frame.enabled; $('frame-color').value = state.frame.color; $('frame-width').value = state.frame.width; }
    if (d.bgColor !== undefined) { state.bgColor = d.bgColor; $('bg-color').value = d.bgColor; }
    if (d.bgImage !== undefined) { state.bgImage = d.bgImage; }
    if (d.bgColor !== undefined || d.bgImage !== undefined) applyBgStyle();
    if (d.lighting !== undefined) {
      state.lighting = { ...state.lighting, ...d.lighting };
      $('light-toggle').checked = state.lighting.enabled;
      $('light-preset').value = state.lighting.preset || 'custom';
      $('light-brightness').value = state.lighting.brightness;
      $('light-contrast').value = state.lighting.contrast;
      $('light-saturate').value = state.lighting.saturate;
      $('light-tint').value = state.lighting.tint;
      $('light-tint-amount').value = state.lighting.tintAmount;
      document.querySelectorAll('.setting-row.light-settings').forEach(el => {
        el.classList.toggle('hidden', !state.lighting.enabled);
      });
      applyLighting();
    }
    if (d.holeSpacing !== undefined) { CONFIG.holeSpacing = d.holeSpacing; $('hole-spacing').value = d.holeSpacing; }
    if (d.snapEnabled !== undefined) { CONFIG.snapEnabled = d.snapEnabled; $('snap-toggle').checked = d.snapEnabled; }
    if (d.boardWidth !== undefined) { state.boardWidth = d.boardWidth; $('board-width').value = d.boardWidth; }
    if (d.boardHeight !== undefined) { state.boardHeight = d.boardHeight; $('board-height').value = d.boardHeight; }
    if (d.boardPosX !== undefined) { state.boardPosX = d.boardPosX; $('board-pos-x').value = d.boardPosX; }
    if (d.boardPosY !== undefined) { state.boardPosY = d.boardPosY; $('board-pos-y').value = d.boardPosY; }
    if (d.boardThickness !== undefined) { state.boardThickness = d.boardThickness; $('board-thickness').value = d.boardThickness; }
    if (d.holeTransparent !== undefined) { state.holeTransparent = d.holeTransparent; $('hole-transparent-toggle').checked = d.holeTransparent; }

    updateBoardSize();
    updateBoardPosition();
    updateBoardThickness();
    setShowHoles(state.showHoles);
    updateFrameStyle();

    if (d.items && Array.isArray(d.items)) {
      d.items.forEach(itemData => {
        createItem(itemData.type, {
          x: itemData.x,
          y: itemData.y,
          scale: itemData.scale,
          rotation: itemData.rotation,
          width: itemData.width,
          height: itemData.height,
          color: itemData.color,
          imageUrl: itemData.imageUrl,
          name: itemData.name,
          showName: itemData.showName,
          shadow: itemData.shadow,
          skipSnap: true
        });
      });
    }
  }

  function renderSavesList() {
    const saves = getSaves();
    const listEl = $('saves-list');
    if (saves.length === 0) {
      listEl.innerHTML = '<p class="save-hint">暂无保存记录</p>';
      return;
    }
    listEl.innerHTML = saves.map(s => `
      <div class="save-item">
        <div class="save-item-info">
          <span class="save-item-name">${escapeHtml(s.name)}</span>
          <span class="save-item-code">${s.code} · ${formatDate(s.createdAt)}</span>
        </div>
        <div class="save-item-actions">
          <button class="cyber-btn small" onclick="loadSave('${s.code}')">加载</button>
          <button class="cyber-btn small" onclick="copySaveCode('${s.code}')">复制码</button>
          <button class="cyber-btn small danger" onclick="removeSave('${s.code}')">删除</button>
        </div>
      </div>
    `).join('');
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  window.loadSave = function(code) {
    const save = findSaveByCode(code);
    if (save) { applySaveData(save); closeImportModal(); }
  };

  window.copySaveCode = function(code) {
    navigator.clipboard.writeText(code).then(() => { alert('分享码已复制：' + code); });
  };

  window.removeSave = function(code) {
    if (confirm('确定要删除这个保存吗？')) { deleteSave(code); renderSavesList(); }
  };

  // ========== 弹窗控制 ==========
  function openSaveModal() { $('save-name').value = ''; document.querySelector('.save-code-section').style.display = 'none'; $('save-modal').style.display = 'flex'; }
  function closeSaveModal() { $('save-modal').style.display = 'none'; }
  function openImportModal() { $('import-code').value = ''; $('import-error').style.display = 'none'; renderSavesList(); $('import-modal').style.display = 'flex'; }
  function closeImportModal() { $('import-modal').style.display = 'none'; }

  // ========== 截图 ==========
  async function takeScreenshot() {
    const wasSelected = state.selectedItem;
    deselectItem();

    const uiElements = [
      document.querySelector('header.top-bar'),
      document.querySelector('aside.toolbar.left'),
      document.querySelector('aside.toolbar.right'),
      document.querySelector('footer.bottom-bar')
    ];
    const savedDisplay = uiElements.map(el => el ? el.style.display : null);
    uiElements.forEach(el => { if (el) el.style.display = 'none'; });

    await new Promise(r => setTimeout(r, 300));
    renderer.render(scene, camera);

    try {
      const dataUrl = renderer.domElement.toDataURL('image/png');
      $('screenshot-preview').src = dataUrl;
      $('screenshot-modal').style.display = 'flex';

      $('btn-download').onclick = () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `赛博痛墙_${Date.now()}.png`;
        a.click();
      };
    } catch (err) {
      console.error('截图失败:', err);
      alert('截图失败，请重试');
    } finally {
      uiElements.forEach((el, i) => {
        if (el && savedDisplay[i] !== null) el.style.display = savedDisplay[i];
        else if (el) el.style.display = '';
      });
    }

    if (wasSelected) selectItem(wasSelected);
  }

  // ========== 射线拾取与拖拽 ==========
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let dragPlane = new THREE.Plane();
  let dragOffset = new THREE.Vector3();
  let draggedMesh = null;

  function setupInteraction() {
    const canvas = renderer.domElement;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const meshes = Array.from(itemMeshes.values());
      const intersects = raycaster.intersectObjects(meshes, true); // 递归搜索 Group 子对象

      if (intersects.length > 0) {
        // 找到被点击的子对象所属的父级 Group/Mesh
        let hitObj = intersects[0].object;
        const itemId = hitObj.userData.itemId;
        const itemData = state.items.find(i => i.id === itemId);
        if (itemData) {
          // 使用顶级对象（Group 或 Mesh）进行拖拽
          const topObj = itemMeshes.get(itemId);
          controls.enabled = false;
          draggedMesh = topObj;
          selectItem(itemData);

          // 建立拖拽平面（平行于板子）
          const normal = new THREE.Vector3(0, 0, 1);
          normal.transformDirection(topObj.matrixWorld);
          dragPlane.setFromNormalAndCoplanarPoint(normal, intersects[0].point);

          dragOffset.copy(intersects[0].point).sub(topObj.position);
        }
      } else {
        deselectItem();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!draggedMesh) return;

      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const newPos = intersection.sub(dragOffset);
        draggedMesh.position.x = newPos.x;
        draggedMesh.position.y = newPos.y;

        // 同步到 itemData（板子坐标系）
        const itemId = draggedMesh.userData.itemId;
        const itemData = state.items.find(i => i.id === itemId);
        if (itemData) {
          itemData.x = newPos.x + CONFIG.board.width / 2;
          itemData.y = CONFIG.board.height / 2 - newPos.y;
        }
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (draggedMesh) {
        const itemId = draggedMesh.userData.itemId;
        const itemData = state.items.find(i => i.id === itemId);
        if (itemData) {
          // 吸附
          const snapped = snapToHole(itemData.x, itemData.y);
          itemData.x = snapped.x;
          itemData.y = snapped.y;
          updateItemMesh(itemData);
        }
        draggedMesh = null;
        controls.enabled = true;
      }
    });
  }

  // ========== 初始化 UI ==========
  function initUI() {
    document.querySelectorAll('.item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (!type) return;
        const item = createItem(type);
        if (item) selectItem(item);
      });
    });

    const btnUpload = $('btn-upload-item');
    const fileInput = $('upload-item-file');
    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }

        const reader = new FileReader();
        const originalDataUrl = await new Promise((resolve, reject) => {
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        showBgRemovalProgress();
        try {
          const bgRemovedDataUrl = await removeBgFromImage(originalDataUrl);
          const item = createItem('custom', { imageUrl: bgRemovedDataUrl });
          if (item) selectItem(item);
        } catch (err) {
          console.warn('抠图失败，使用原图:', err);
          const item = createItem('custom', { imageUrl: originalDataUrl });
          if (item) selectItem(item);
          alert('抠图处理失败，已使用原图。\n原因: ' + (err.message || err));
        } finally {
          hideBgRemovalProgress();
        }
        fileInput.value = '';
      });
    }

    $('btn-reset-view').addEventListener('click', () => {
      if (confirm('确定要清空所有物品吗？')) {
        state.items.forEach(item => removeItemMesh(item));
        state.items = [];
        deselectItem();
      }
    });

    function toggleSidebar(show) {
      const sidebar = document.querySelector('.toolbar.left');
      const showBtn = $('btn-sidebar-show');
      if (!sidebar) return;
      if (show === undefined) sidebar.classList.toggle('hidden');
      else if (show) sidebar.classList.remove('hidden');
      else sidebar.classList.add('hidden');
      if (showBtn) {
        if (sidebar.classList.contains('hidden')) showBtn.classList.add('visible');
        else showBtn.classList.remove('visible');
      }
    }
    $('btn-toggle-sidebar').addEventListener('click', () => toggleSidebar());
    $('btn-sidebar-minimize').addEventListener('click', () => toggleSidebar(false));
    $('btn-sidebar-show').addEventListener('click', () => toggleSidebar(true));

    $('btn-save').addEventListener('click', openSaveModal);
    $('btn-close-save').addEventListener('click', closeSaveModal);
    $('btn-confirm-save').addEventListener('click', () => {
      const name = $('save-name').value.trim() || '未命名布局';
      const save = saveLayout(name);
      $('save-code-text').textContent = save.code;
      document.querySelector('.save-code-section').style.display = 'block';
    });
    $('btn-copy-code').addEventListener('click', () => {
      const code = $('save-code-text').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = $('btn-copy-code');
        const original = btn.textContent;
        btn.textContent = '已复制!';
        setTimeout(() => btn.textContent = original, 1500);
      });
    });

    $('btn-import').addEventListener('click', openImportModal);
    $('btn-close-import').addEventListener('click', closeImportModal);
    $('btn-confirm-import').addEventListener('click', () => {
      const code = $('import-code').value.trim().toUpperCase();
      if (!code) { $('import-error').style.display = 'block'; $('import-error').textContent = '请输入分享码'; return; }
      const save = findSaveByCode(code);
      if (!save) { $('import-error').style.display = 'block'; $('import-error').textContent = '分享码无效或未找到（仅同设备同浏览器可用）'; return; }
      applySaveData(save);
      closeImportModal();
    });
    $('import-code').addEventListener('input', () => { $('import-error').style.display = 'none'; });

    $('btn-screenshot').addEventListener('click', takeScreenshot);
    $('btn-close-modal').addEventListener('click', () => { $('screenshot-modal').style.display = 'none'; });

    // 裁剪弹窗事件
    $('btn-cancel-crop').addEventListener('click', () => {
      if (cropCallback) cropCallback.reject(new Error('用户取消'));
      closeCropModal();
    });
    $('btn-confirm-crop').addEventListener('click', confirmCrop);
    $('crop-shape').addEventListener('change', (e) => {
      currentCropShape = e.target.value;
      setCropAspectRatio(currentCropShape);
    });
    $('crop-zoom-in').addEventListener('click', () => {
      if (cropperInstance) cropperInstance.zoom(0.1);
    });
    $('crop-zoom-out').addEventListener('click', () => {
      if (cropperInstance) cropperInstance.zoom(-0.1);
    });
    $('crop-rotate-left').addEventListener('click', () => {
      if (cropperInstance) cropperInstance.rotate(-90);
    });
    $('crop-rotate-right').addEventListener('click', () => {
      if (cropperInstance) cropperInstance.rotate(90);
    });
    $('crop-reset').addEventListener('click', () => {
      if (cropperInstance) cropperInstance.reset();
    });
    // ESC 键关闭裁剪弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('crop-modal').style.display === 'flex') {
        if (cropCallback) cropCallback.reject(new Error('用户取消'));
        closeCropModal();
      }
    });

    $('item-name').addEventListener('input', (e) => updateSelectedName(e.target.value));
    $('name-toggle').addEventListener('change', (e) => updateSelectedShowName(e.target.checked));
    $('upload-image').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => applyImageToSelected(ev.target.result, true); // 默认就按形状裁剪
      reader.readAsDataURL(file);
      e.target.value = '';
    });
    $('btn-crop-image').addEventListener('click', () => {
      if (!state.selectedItem || !state.selectedItem.imageUrl) return;
      applyImageToSelected(state.selectedItem.imageUrl, true);
    });
    $('item-color').addEventListener('input', (e) => updateSelectedColor(e.target.value));
    $('item-scale').addEventListener('input', (e) => updateSelectedScale(parseFloat(e.target.value)));
    $('item-width').addEventListener('input', (e) => updateSelectedWidth(parseInt(e.target.value)));
    $('item-height').addEventListener('input', (e) => updateSelectedHeight(parseInt(e.target.value)));
    $('item-rotation').addEventListener('input', (e) => updateSelectedRotation(parseFloat(e.target.value)));

    $('shadow-toggle').addEventListener('change', (e) => updateSelectedShadowEnabled(e.target.checked));
    $('shadow-color').addEventListener('input', (e) => updateSelectedShadowColor(e.target.value));
    $('shadow-opacity').addEventListener('input', (e) => updateSelectedShadowOpacity(parseFloat(e.target.value)));
    $('shadow-offsety').addEventListener('input', (e) => updateSelectedShadowOffsetY(parseInt(e.target.value)));
    $('shadow-blur').addEventListener('input', (e) => updateSelectedShadowBlur(parseInt(e.target.value)));

    $('btn-duplicate').addEventListener('click', duplicateSelected);
    $('btn-delete').addEventListener('click', deleteSelected);

    $('board-color').addEventListener('input', (e) => setBoardColor(e.target.value));
    $('holes-toggle').addEventListener('change', (e) => setShowHoles(e.target.checked));
    $('hole-color').addEventListener('input', (e) => setHoleColor(e.target.value));
    $('hole-spacing').addEventListener('input', (e) => setHoleSpacing(parseInt(e.target.value)));
    $('snap-toggle').addEventListener('change', (e) => {
      CONFIG.snapEnabled = e.target.checked;
    });
    $('board-width').addEventListener('input', (e) => setBoardWidth(e.target.value));
    $('board-height').addEventListener('input', (e) => setBoardHeight(e.target.value));
    $('board-pos-x').addEventListener('input', (e) => setBoardPosX(e.target.value));
    $('board-pos-y').addEventListener('input', (e) => setBoardPosY(e.target.value));
    $('board-thickness').addEventListener('input', (e) => setBoardThickness(e.target.value));
    $('hole-transparent-toggle').addEventListener('change', (e) => setHoleTransparent(e.target.checked));

    $('frame-toggle').addEventListener('change', (e) => setFrameEnabled(e.target.checked));
    $('frame-color').addEventListener('input', (e) => setFrameColor(e.target.value));
    $('frame-width').addEventListener('input', (e) => setFrameWidth(parseInt(e.target.value)));

    $('bg-color').addEventListener('input', (e) => setBgColor(e.target.value));
    $('btn-clear-bg').addEventListener('click', clearBgImage);
    $('upload-bg-image').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { setBgImage(ev.target.result); };
      reader.readAsDataURL(file);
    });

    $('cam-rotatex').addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      if (controls) {
        const target = new THREE.Vector3();
        controls.target.copy(target);
        const radius = camera.position.distanceTo(controls.target);
        const radX = deg * Math.PI / 180;
        camera.position.y = controls.target.y + radius * Math.sin(radX);
        const cosX = Math.cos(radX);
        camera.position.x = controls.target.x + radius * cosX * Math.sin(controls.getAzimuthalAngle());
        camera.position.z = controls.target.z + radius * cosX * Math.cos(controls.getAzimuthalAngle());
        camera.lookAt(controls.target);
      }
    });
    $('cam-rotatey').addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      // 与 OrbitControls 同步
    });
    $('cam-zoom').addEventListener('input', (e) => {
      const zoom = parseFloat(e.target.value);
      const distance = 1800 / zoom;
      const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
    });
    $('btn-reset-cam').addEventListener('click', () => {
      // 重置到一个能看到长方体厚度的角度
      camera.position.set(-400, 250, 1600);
      controls.target.set(0, 0, 0);
      controls.update();
      $('cam-rotatex').value = 0;
      $('cam-rotatey').value = 0;
      $('cam-zoom').value = 1;
    });

    $('light-toggle').addEventListener('change', (e) => setLightEnabled(e.target.checked));
    $('light-preset').addEventListener('change', (e) => setLightPreset(e.target.value));
    $('light-brightness').addEventListener('input', (e) => setLightBrightness(e.target.value));
    $('light-contrast').addEventListener('input', (e) => setLightContrast(e.target.value));
    $('light-saturate').addEventListener('input', (e) => setLightSaturate(e.target.value));
    $('light-tint').addEventListener('input', (e) => setLightTint(e.target.value));
    $('light-tint-amount').addEventListener('input', (e) => setLightTintAmount(e.target.value));

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicateSelected(); }
      if (e.key === 'Escape') { deselectItem(); }
    });
  }

  // ========== 启动 ==========
  function start() {
    initThree();
    setupInteraction();
    initUI();

    updateFrameStyle();
    applyBgStyle();
    $('bg-color').value = state.bgColor;

    setShowHoles(state.showHoles);
    setLightPreset(state.lighting.preset);
    applyLighting();

    $('loading').classList.add('hidden');
    setTimeout(() => { $('loading').style.display = 'none'; }, 600);
  }

  window.__itawall = {
    openSaveModal, closeSaveModal, openImportModal, closeImportModal,
    saveLayout, getSaves, findSaveByCode, applySaveData,
    applyImageToSelected, cropImageToShape, state, scene, camera, renderer, boardMesh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
