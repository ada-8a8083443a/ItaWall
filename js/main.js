// ===== 赛博痛墙 - 2D 洞洞板系统 =====
(function() {
  'use strict';

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
    badge:    { width: 80,  height: 80,  hasImage: true,  defaultColor: '#ff6b9d' },
    polaroid: { width: 100, height: 130, hasImage: true,  defaultColor: '#f5f0e6' },
    card:     { width: 90,  height: 135, hasImage: true,  defaultColor: '#4fc3f7' },
    stand:    { width: 90,  height: 130, hasImage: true,  defaultColor: '#ffd54f' },
    petal:    { width: 40,  height: 40,  hasImage: false, defaultColor: '#ff80ab' },
    star:     { width: 40,  height: 40,  hasImage: false, defaultColor: '#ffeb3b' },
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
    boardColor: '#2d1b4e',
    holeColor: '#1a0a2e',
    showHoles: true,
    frame: {
      enabled: true,
      color: '#8b5cf6',
      width: 8
    },
    camera: {
      rotateX: 0,
      rotateY: 0,
      zoom: 1
    },
    cameraDragging: null,
    lighting: {
      enabled: true,
      preset: 'cyberpunk',
      brightness: 1,
      contrast: 1,
      saturate: 1,
      tint: '#b300ff',
      tintAmount: 0.15
    }
  };

  // 光效预设配置
  const LIGHT_PRESETS = {
    cyberpunk: { brightness: 1.05, contrast: 1.15, saturate: 1.2, tint: '#b300ff', tintAmount: 0.2 },
    warm:      { brightness: 1.1,  contrast: 1.05, saturate: 1.1, tint: '#ff9500', tintAmount: 0.2 },
    cool:      { brightness: 1.05, contrast: 1.1,  saturate: 0.95,tint: '#00aaff', tintAmount: 0.15 },
    neon:      { brightness: 1.15, contrast: 1.3,  saturate: 1.5, tint: '#ff00ff', tintAmount: 0.25 },
    sunset:    { brightness: 1.1,  contrast: 1.1,  saturate: 1.2, tint: '#ff6b35', tintAmount: 0.25 },
    natural:   { brightness: 1,    contrast: 1,     saturate: 1,    tint: '#ffffff', tintAmount: 0 }
  };

  // ========== DOM 引用 ==========
  const $ = (id) => document.getElementById(id);
  const pegboard = $('pegboard');
  const propertyPanel = $('property-panel');

  // ========== 工具函数 ==========
  function uid() { return 'item_' + (state.nextId++); }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function toRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // ========== 洞洞板初始化 ==========
  function initPegboard() {
    updateBoardSize();
    generateHoles();
    window.addEventListener('resize', () => {
      updateBoardSize();
      generateHoles();
    });
  }

  function updateBoardSize() {
    const margin = 320;
    const w = clamp(window.innerWidth - margin, CONFIG.board.minWidth, 1400);
    const h = clamp(window.innerHeight - 200, CONFIG.board.minHeight, 900);
    pegboard.style.width = w + 'px';
    pegboard.style.height = h + 'px';
    CONFIG.board.width = w;
    CONFIG.board.height = h;
  }

  function generateHoles() {
    // 清除旧孔位
    pegboard.querySelectorAll('.pegboard-hole').forEach(el => el.remove());
    state.holePositions = [];

    const spacing = CONFIG.holeSpacing;
    const startX = spacing;
    const startY = spacing;
    const endX = CONFIG.board.width - spacing;
    const endY = CONFIG.board.height - spacing;

    for (let y = startY; y <= endY; y += spacing) {
      for (let x = startX; x <= endX; x += spacing) {
        state.holePositions.push({ x, y });
        const hole = document.createElement('div');
        hole.className = 'pegboard-hole';
        hole.style.left = x + 'px';
        hole.style.top = y + 'px';
        hole.dataset.x = x;
        hole.dataset.y = y;
        pegboard.appendChild(hole);
      }
    }
  }

  // ========== 摄像头控制 ==========
  function updateCameraTransform() {
    const { rotateX, rotateY, zoom } = state.camera;
    pegboard.style.transform = `
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(${zoom})
    `;
  }

  function setCameraRotateX(deg) {
    state.camera.rotateX = clamp(deg, -45, 45);
    updateCameraTransform();
  }

  function setCameraRotateY(deg) {
    state.camera.rotateY = clamp(deg, -45, 45);
    updateCameraTransform();
  }

  function setCameraZoom(z) {
    state.camera.zoom = clamp(z, 0.5, 2);
    updateCameraTransform();
  }

  function resetCamera() {
    state.camera.rotateX = 0;
    state.camera.rotateY = 0;
    state.camera.zoom = 1;
    $('cam-rotatex').value = 0;
    $('cam-rotatey').value = 0;
    $('cam-zoom').value = 1;
    updateCameraTransform();
  }

  // ========== 光效控制 ==========
  function applyLighting() {
    const l = state.lighting;
    if (!l.enabled) {
      pegboard.style.filter = '';
      const overlay = pegboard.querySelector('.pegboard-lighting-overlay');
      if (overlay) overlay.remove();
      return;
    }

    // 基础滤镜（亮度、对比度、饱和度）
    pegboard.style.filter = `
      brightness(${l.brightness})
      contrast(${l.contrast})
      saturate(${l.saturate})
    `;

    // 色调叠加
    let overlay = pegboard.querySelector('.pegboard-lighting-overlay');
    if (l.tintAmount > 0 && l.tint) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pegboard-lighting-overlay';
        pegboard.appendChild(overlay);
      }
      const rgb = toRgb(l.tint);
      overlay.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${l.tintAmount})`;
      overlay.style.opacity = '1';
    } else if (overlay) {
      overlay.remove();
    }
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
      // 同步 UI
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
    // 显示/隐藏子设置
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

  function showSnapHint(hole) {
    clearSnapHints();
    if (!hole) return;
    const el = pegboard.querySelector(`.pegboard-hole[data-x="${hole.x}"][data-y="${hole.y}"]`);
    if (el) el.classList.add('snap-hint');
  }

  function clearSnapHints() {
    pegboard.querySelectorAll('.pegboard-hole.snap-hint').forEach(el => {
      el.classList.remove('snap-hint');
    });
  }

  // ========== 抠图处理 ==========
  function showBgRemovalProgress() {
    if (document.querySelector('.bg-removal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'bg-removal-overlay';
    overlay.innerHTML = `
      <div class="bg-removal-modal">
        <h3>✂️ AI 智能抠图中</h3>
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
    // 等待抠图库加载完成
    if (!window.removeBackground) {
      updateBgRemovalProgress(5, '正在加载 AI 抠图引擎...');
      await new Promise((resolve) => {
        if (window.removeBackground) return resolve();
        document.addEventListener('bg-removal-ready', resolve, { once: true });
        setTimeout(resolve, 15000); // 最多等 15 秒
      });
    }

    if (!window.removeBackground) {
      throw new Error('AI 抠图引擎加载失败，请刷新页面重试');
    }

    updateBgRemovalProgress(10, '正在下载 AI 模型（首次使用约 80MB）...');

    const resultBlob = await window.removeBackground(imageSrc, {
      progress: (key, current, total) => {
        const pct = total > 0 ? (current / total) * 100 : 0;
        // 模型下载阶段占 10-60%
        const downloadPct = 10 + (pct * 0.5);
        updateBgRemovalProgress(downloadPct, `正在加载 ${key}...`);
      },
      output: {
        format: 'image/png',
        type: 'foreground'
      }
    });

    updateBgRemovalProgress(70, '正在进行 AI 智能抠图...');

    // 转换为 dataURL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });

    updateBgRemovalProgress(100, '抠图完成！');
    return dataUrl;
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

    // 初始位置吸附（恢复布局时可跳过）
    if (!options.skipSnap) {
      const snapped = snapToHole(itemData.x, itemData.y);
      itemData.x = snapped.x;
      itemData.y = snapped.y;
    }

    state.items.push(itemData);
    renderItem(itemData);
    return itemData;
  }

  function renderItem(itemData) {
    // 移除旧 DOM
    const oldEl = document.getElementById(itemData.id);
    if (oldEl) oldEl.remove();

    const el = document.createElement('div');
    el.id = itemData.id;
    el.className = 'peg-item ' + itemData.type;
    el.dataset.id = itemData.id;

    updateItemStyle(el, itemData);
    buildItemContent(el, itemData);

    // 事件绑定
    bindItemEvents(el, itemData);

    pegboard.appendChild(el);
  }

  function updateItemStyle(el, itemData) {
    const w = itemData.config.width * itemData.scale;
    const h = itemData.config.height * itemData.scale;

    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = (itemData.x - w / 2) + 'px';
    el.style.top = (itemData.y - h / 2) + 'px';
    el.style.transform = `rotate(${itemData.rotation}deg)`;
    el.style.zIndex = state.items.indexOf(itemData) + 10;

    // 应用阴影
    applyItemShadow(el, itemData);
  }

  // 生成物品阴影
  function buildItemShadow(itemData) {
    const s = itemData.shadow;
    if (!s || !s.enabled) return null;

    // 提取颜色并调整透明度
    let color = s.color;
    if (s.opacity !== undefined && s.opacity >= 0) {
      // 尝试将颜色转为 rgba
      if (color.startsWith('#')) {
        const rgb = toRgb(color);
        color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.opacity})`;
      } else if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
        // 替换 alpha
        const rgb = toRgb(color);
        color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.opacity})`;
      }
    }

    return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${color}`;
  }

  function applyItemShadow(el, itemData) {
    const s = itemData.shadow;
    const cfg = ITEM_CONFIG[itemData.type];
    const isCustomWithImage = cfg && cfg.isCustom && itemData.imageUrl;

    if (s && s.enabled) {
      // 提取颜色并调整透明度
      let color = s.color;
      if (s.opacity !== undefined && s.opacity >= 0) {
        if (color.startsWith('#')) {
          const rgb = toRgb(color);
          color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.opacity})`;
        } else if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
          const rgb = toRgb(color);
          color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.opacity})`;
        }
      }
      // filter: drop-shadow() 不支持 spread，使用 4 参数格式
      el.style.filter = `drop-shadow(${s.offsetX}px ${s.offsetY}px ${s.blur}px ${color})`;

      // custom 物品有图片时，移除默认的 box-shadow、border 和 background-color，
      // 这样 drop-shadow 才能正确沿着透明图片的轮廓生成阴影
      if (isCustomWithImage) {
        el.style.boxShadow = 'none';
        el.style.border = 'none';
        el.style.backgroundColor = 'transparent';
      }
    } else {
      el.style.filter = '';
      // custom 物品有图片且关闭自定义阴影时，移除不透明样式让用户看到透明效果
      if (isCustomWithImage) {
        el.style.boxShadow = 'none';
        el.style.border = 'none';
        el.style.backgroundColor = 'transparent';
      } else if (cfg && cfg.isCustom) {
        // 无图片时恢复默认样式
        el.style.boxShadow = '';
        el.style.border = '';
        el.style.backgroundColor = '';
      }
    }
  }

  function buildItemContent(el, itemData) {
    el.innerHTML = '';

    switch (itemData.type) {
      case 'badge':
        if (itemData.imageUrl) {
          el.style.backgroundImage = `url(${itemData.imageUrl})`;
          el.style.backgroundColor = itemData.color;
        } else {
          el.style.backgroundImage = `radial-gradient(circle at 30% 30%, ${lighten(itemData.color, 30)}, ${itemData.color} 50%, ${darken(itemData.color, 20)})`;
        }
        break;

      case 'polaroid':
        el.style.backgroundColor = '#f5f0e6';
        const photo = document.createElement('div');
        photo.className = 'polaroid-photo';
        if (itemData.imageUrl) {
          photo.style.backgroundImage = `url(${itemData.imageUrl})`;
        } else {
          photo.innerHTML = '<div class="placeholder">+</div>';
        }
        el.appendChild(photo);
        break;

      case 'card':
      case 'stand':
        if (itemData.imageUrl) {
          el.style.backgroundImage = `url(${itemData.imageUrl})`;
        } else {
          // 用 canvas 绘制带颜色的卡片
          el.style.backgroundImage = `linear-gradient(135deg, ${lighten(itemData.color, 20)}, ${itemData.color})`;
          const placeholder = document.createElement('div');
          placeholder.className = 'placeholder';
          placeholder.textContent = '+';
          placeholder.style.borderRadius = 'inherit';
          el.appendChild(placeholder);
        }
        break;

      case 'petal':
        // SVG 花瓣
        el.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(createPetalSVG(itemData.color))}")`;
        break;

      case 'star':
        // SVG 星星
        el.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(createStarSVG(itemData.color))}")`;
        break;

      case 'custom':
        if (itemData.imageUrl) {
          // 使用 <img> 元素而不是 background-image，
          // 这样 drop-shadow 才能正确沿着透明图片的轮廓生成阴影
          el.style.backgroundImage = '';
          el.style.backgroundColor = 'transparent';
          const img = document.createElement('img');
          img.src = itemData.imageUrl;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          img.style.display = 'block';
          img.style.pointerEvents = 'none';
          img.draggable = false;
          el.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'placeholder';
          placeholder.textContent = '＋';
          placeholder.style.borderRadius = 'inherit';
          el.appendChild(placeholder);
        }
        break;
    }

    // 渲染物品名称标签
    if (itemData.name && itemData.showName) {
      const label = document.createElement('div');
      label.className = 'item-label';
      label.textContent = itemData.name;
      el.appendChild(label);
    }
  }

  function createPetalSVG(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <g fill="${color}" transform="translate(32,32)">
        ${[0, 60, 120, 180, 240, 300].map(deg =>
          `<ellipse cx="0" cy="-14" rx="8" ry="16" transform="rotate(${deg})"/>`
        ).join('')}
        <circle cx="0" cy="0" r="6" fill="${darken(color, 30)}"/>
      </g>
    </svg>`;
  }

  function createStarSVG(color) {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 28 : 12;
      const a = (i * 36 - 90) * Math.PI / 180;
      points.push(`${32 + r * Math.cos(a)},${32 + r * Math.sin(a)}`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <polygon points="${points.join(' ')}" fill="${color}" stroke="${darken(color, 20)}" stroke-width="2"/>
    </svg>`;
  }

  function lighten(hex, amount) {
    const { r, g, b } = toRgb(hex);
    return `rgb(${clamp(r + amount, 0, 255)},${clamp(g + amount, 0, 255)},${clamp(b + amount, 0, 255)})`;
  }

  function darken(hex, amount) {
    const { r, g, b } = toRgb(hex);
    return `rgb(${clamp(r - amount, 0, 255)},${clamp(g - amount, 0, 255)},${clamp(b - amount, 0, 255)})`;
  }

  // ========== 拖拽 ==========
  function bindItemEvents(el, itemData) {
    el.addEventListener('mousedown', (e) => startDrag(e, itemData, el));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(itemData);
    });
  }

  function startDrag(e, itemData, el) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = pegboard.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    state.dragging = {
      item: itemData,
      el,
      offsetX: mouseX - itemData.x,
      offsetY: mouseY - itemData.y,
      moved: false
    };

    el.classList.add('dragging');
    selectItem(itemData);

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function onDrag(e) {
    if (!state.dragging) return;

    const rect = pegboard.getBoundingClientRect();
    let x = e.clientX - rect.left - state.dragging.offsetX;
    let y = e.clientY - rect.top - state.dragging.offsetY;

    // 限制在板内
    const w = state.dragging.item.config.width * state.dragging.item.scale;
    const h = state.dragging.item.config.height * state.dragging.item.scale;
    x = clamp(x, w / 2, CONFIG.board.width - w / 2);
    y = clamp(y, h / 2, CONFIG.board.height - h / 2);

    // 显示吸附提示
    if (CONFIG.snapEnabled) {
      const { hole, distance } = findNearestHole(x, y);
      if (distance <= CONFIG.snapThreshold) {
        showSnapHint(hole);
      } else {
        clearSnapHints();
      }
    }

    state.dragging.item.x = x;
    state.dragging.item.y = y;
    state.dragging.moved = true;

    const el = state.dragging.el;
    el.style.left = (x - w / 2) + 'px';
    el.style.top = (y - h / 2) + 'px';
  }

  function endDrag(e) {
    if (!state.dragging) return;

    const itemData = state.dragging.item;
    const el = state.dragging.el;

    // 吸附到最近孔位
    const snapped = snapToHole(itemData.x, itemData.y);
    itemData.x = snapped.x;
    itemData.y = snapped.y;

    const w = itemData.config.width * itemData.scale;
    const h = itemData.config.height * itemData.scale;
    el.style.left = (snapped.x - w / 2) + 'px';
    el.style.top = (snapped.y - h / 2) + 'px';

    el.classList.remove('dragging');
    clearSnapHints();

    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    state.dragging = null;
  }

  // ========== 选中 / 属性面板 ==========
  function selectItem(itemData) {
    // 移除旧选中
    if (state.selectedItem) {
      const oldEl = document.getElementById(state.selectedItem.id);
      if (oldEl) oldEl.classList.remove('selected');
    }

    state.selectedItem = itemData;

    const el = document.getElementById(itemData.id);
    if (el) el.classList.add('selected');

    // 置顶
    const idx = state.items.indexOf(itemData);
    if (idx > -1) {
      state.items.splice(idx, 1);
      state.items.push(itemData);
      state.items.forEach((item, i) => {
        const e = document.getElementById(item.id);
        if (e) e.style.zIndex = i + 10;
      });
    }

    showPropertyPanel(itemData);
  }

  function deselectItem() {
    if (state.selectedItem) {
      const el = document.getElementById(state.selectedItem.id);
      if (el) el.classList.remove('selected');
    }
    state.selectedItem = null;
    propertyPanel.style.display = 'none';
  }

  function showPropertyPanel(itemData) {
    propertyPanel.style.display = 'block';
    const cfg = itemData.config;

    // 名称
    $('item-name').value = itemData.name || '';
    $('name-toggle').checked = itemData.showName;

    // 颜色设置可见性
    $('color-setting').style.display = cfg.hasImage || itemData.type === 'petal' || itemData.type === 'star' ? 'flex' : 'none';
    $('item-color').value = rgbToHex(itemData.color);

    // 大小
    $('item-scale').value = itemData.scale;

    // 旋转
    $('item-rotation').value = itemData.rotation;

    // 阴影设置
    const s = itemData.shadow || {};
    $('shadow-toggle').checked = s.enabled !== false;
    $('shadow-color').value = rgbToHex(s.color || '#000000');
    $('shadow-opacity').value = s.opacity !== undefined ? s.opacity : 0.7;
    $('shadow-offsety').value = s.offsetY !== undefined ? s.offsetY : 4;
    $('shadow-blur').value = s.blur !== undefined ? s.blur : 12;

    // 阴影子设置显示/隐藏
    document.querySelectorAll('.shadow-settings').forEach(el => {
      if (s.enabled !== false) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function rgbToHex(color) {
    if (color.startsWith('#')) return color;
    const match = color.match(/\d+/g);
    if (!match) return '#ff6b9d';
    return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // ========== 物品操作 ==========
  function deleteSelected() {
    if (!state.selectedItem) return;
    const id = state.selectedItem.id;
    const el = document.getElementById(id);
    if (el) el.remove();
    state.items = state.items.filter(i => i.id !== id);
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
      color: src.color,
      imageUrl: src.imageUrl
    });
    if (newItem) selectItem(newItem);
  }

  function applyImageToSelected(imageUrl) {
    if (!state.selectedItem) return;
    state.selectedItem.imageUrl = imageUrl;
    const el = document.getElementById(state.selectedItem.id);
    if (el) buildItemContent(el, state.selectedItem);
  }

  function updateSelectedColor(color) {
    if (!state.selectedItem) return;
    state.selectedItem.color = color;
    const el = document.getElementById(state.selectedItem.id);
    if (el) buildItemContent(el, state.selectedItem);
  }

  function updateSelectedScale(scale) {
    if (!state.selectedItem) return;
    state.selectedItem.scale = scale;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  function updateSelectedRotation(deg) {
    if (!state.selectedItem) return;
    state.selectedItem.rotation = deg;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  // ========== 阴影设置 ==========
  function updateSelectedShadowEnabled(enabled) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.enabled = enabled;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
    // 显示/隐藏阴影子设置
    document.querySelectorAll('.shadow-settings').forEach(el => {
      if (enabled) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function updateSelectedShadowColor(color) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.color = color;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  function updateSelectedShadowOpacity(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.opacity = val;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  function updateSelectedShadowOffsetY(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.offsetY = val;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  function updateSelectedShadowBlur(val) {
    if (!state.selectedItem) return;
    if (!state.selectedItem.shadow) state.selectedItem.shadow = {};
    state.selectedItem.shadow.blur = val;
    const el = document.getElementById(state.selectedItem.id);
    if (el) updateItemStyle(el, state.selectedItem);
  }

  // ========== 洞洞板设置 ==========
  function setBoardColor(color) {
    state.boardColor = color;
    pegboard.style.backgroundColor = color;
    document.documentElement.style.setProperty('--board-color', color);
  }

  function setHoleColor(color) {
    state.holeColor = color;
    document.documentElement.style.setProperty('--hole-color', color);
  }

  function setHoleSpacing(spacing) {
    CONFIG.holeSpacing = spacing;
    document.documentElement.style.setProperty('--hole-spacing', spacing + 'px');
    generateHoles();
    // 重新吸附所有物品
    state.items.forEach(item => {
      const snapped = snapToHole(item.x, item.y);
      item.x = snapped.x;
      item.y = snapped.y;
      const el = document.getElementById(item.id);
      if (el) updateItemStyle(el, item);
    });
  }

  // ========== 孔洞开关 ==========
  function setShowHoles(show) {
    state.showHoles = show;
    if (show) {
      pegboard.classList.remove('no-holes');
    } else {
      pegboard.classList.add('no-holes');
    }
    // 显示/隐藏孔洞相关设置
    document.querySelectorAll('.holes-settings').forEach(el => {
      if (show) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  // ========== 外框设置 ==========
  function updateFrameStyle() {
    const { enabled, color, width } = state.frame;
    if (!enabled || width === 0) {
      pegboard.style.borderWidth = '0px';
      pegboard.style.borderColor = 'transparent';
      pegboard.style.borderStyle = 'solid';
      pegboard.style.outline = 'none';
      pegboard.style.boxShadow = 'none';
    } else {
      // 实心外框：外层粗边框 + 内层高光描边
      pegboard.style.borderWidth = width + 'px';
      pegboard.style.borderColor = color;
      pegboard.style.borderStyle = 'solid';
      // 用 outline 加一层内描边增加立体感
      pegboard.style.outline = `2px solid ${lighten(color, 40)}`;
      pegboard.style.outlineOffset = `-${width + 2}px`;
      // 只保留投影阴影，去掉发光效果
      pegboard.style.boxShadow = `
        0 20px 50px rgba(0, 0, 0, 0.5),
        inset 0 0 40px rgba(0, 0, 0, 0.15)
      `;
    }
    // 显示/隐藏外框相关设置
    document.querySelectorAll('.frame-settings').forEach(el => {
      if (enabled) el.classList.remove('hidden');
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

  // ========== 物品命名 ==========
  function updateSelectedName(name) {
    if (!state.selectedItem) return;
    state.selectedItem.name = name;
    const el = document.getElementById(state.selectedItem.id);
    if (el) buildItemContent(el, state.selectedItem);
  }

  function updateSelectedShowName(show) {
    if (!state.selectedItem) return;
    state.selectedItem.showName = show;
    const el = document.getElementById(state.selectedItem.id);
    if (el) buildItemContent(el, state.selectedItem);
  }

  // ========== 保存/导入系统 ==========
  const STORAGE_KEY = 'itawall_saves';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符

  // 生成16位分享码
  function generateCode() {
    let code = '';
    for (let i = 0; i < 16; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  // 序列化当前状态
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
          color: item.color,
          imageUrl: item.imageUrl,
          name: item.name,
          showName: item.showName,
          shadow: item.shadow ? { ...item.shadow } : undefined
        })),
        boardColor: state.boardColor,
        holeColor: state.holeColor,
        showHoles: state.showHoles,
        frame: { ...state.frame },
        camera: { ...state.camera },
        lighting: { ...state.lighting },
        holeSpacing: CONFIG.holeSpacing,
        snapEnabled: CONFIG.snapEnabled
      }
    };
  }

  // 保存到 localStorage
  function saveLayout(name) {
    const save = serializeState(name);
    const saves = getSaves();
    saves.unshift(save);
    // 最多保存 20 个
    if (saves.length > 20) saves.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    return save;
  }

  // 获取所有保存
  function getSaves() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  // 按码查找
  function findSaveByCode(code) {
    const saves = getSaves();
    return saves.find(s => s.code.toUpperCase() === code.toUpperCase());
  }

  // 删除保存
  function deleteSave(code) {
    const saves = getSaves().filter(s => s.code !== code);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  }

  // 反序列化恢复状态
  function applySaveData(saveData) {
    const d = saveData.data;

    // 清除现有物品
    state.items.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) el.remove();
    });
    state.items = [];
    deselectItem();

    // 恢复设置
    if (d.boardColor !== undefined) {
      state.boardColor = d.boardColor;
      pegboard.style.backgroundColor = d.boardColor;
      document.documentElement.style.setProperty('--board-color', d.boardColor);
      $('board-color').value = d.boardColor;
    }
    if (d.holeColor !== undefined) {
      state.holeColor = d.holeColor;
      document.documentElement.style.setProperty('--hole-color', d.holeColor);
      $('hole-color').value = d.holeColor;
    }
    if (d.showHoles !== undefined) {
      setShowHoles(d.showHoles);
      $('holes-toggle').checked = d.showHoles;
    }
    if (d.frame !== undefined) {
      state.frame = { ...state.frame, ...d.frame };
      updateFrameStyle();
      $('frame-toggle').checked = state.frame.enabled;
      $('frame-color').value = state.frame.color;
      $('frame-width').value = state.frame.width;
    }
    if (d.camera !== undefined) {
      state.camera = { ...state.camera, ...d.camera };
      updateCameraTransform();
      $('cam-rotatex').value = state.camera.rotateX;
      $('cam-rotatey').value = state.camera.rotateY;
      $('cam-zoom').value = state.camera.zoom;
    }
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
    if (d.holeSpacing !== undefined) {
      CONFIG.holeSpacing = d.holeSpacing;
      document.documentElement.style.setProperty('--hole-spacing', d.holeSpacing + 'px');
      $('hole-spacing').value = d.holeSpacing;
      generateHoles();
    }
    if (d.snapEnabled !== undefined) {
      CONFIG.snapEnabled = d.snapEnabled;
      $('snap-toggle').checked = d.snapEnabled;
    }

    // 恢复物品
    if (d.items && Array.isArray(d.items)) {
      d.items.forEach(itemData => {
        createItem(itemData.type, {
          x: itemData.x,
          y: itemData.y,
          scale: itemData.scale,
          rotation: itemData.rotation,
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

  // 渲染保存列表
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

  // 全局函数供 HTML onclick 使用
  window.loadSave = function(code) {
    const save = findSaveByCode(code);
    if (save) {
      applySaveData(save);
      closeImportModal();
    }
  };

  window.copySaveCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
      alert('分享码已复制：' + code);
    });
  };

  window.removeSave = function(code) {
    if (confirm('确定要删除这个保存吗？')) {
      deleteSave(code);
      renderSavesList();
    }
  };

  // ========== 弹窗控制 ==========
  function openSaveModal() {
    $('save-name').value = '';
    document.querySelector('.save-code-section').style.display = 'none';
    $('save-modal').style.display = 'flex';
  }

  function closeSaveModal() {
    $('save-modal').style.display = 'none';
  }

  function openImportModal() {
    $('import-code').value = '';
    $('import-error').style.display = 'none';
    renderSavesList();
    $('import-modal').style.display = 'flex';
  }

  function closeImportModal() {
    $('import-modal').style.display = 'none';
  }

  // ========== 截图 ==========
  async function takeScreenshot() {
    // 先取消选中（去掉选中框）
    const wasSelected = state.selectedItem;
    deselectItem();

    // 临时隐藏 UI 组件（header、左右工具栏、footer）
    const uiElements = [
      document.querySelector('header.top-bar'),
      document.querySelector('aside.toolbar.left'),
      document.querySelector('aside.toolbar.right'),
      document.querySelector('footer.bottom-bar')
    ];
    const savedDisplay = uiElements.map(el => el ? el.style.display : null);
    uiElements.forEach(el => { if (el) el.style.display = 'none'; });

    await new Promise(r => setTimeout(r, 300));

    try {
      // 截取整个页面（不含 UI），保留用户设置的倾斜角度
      const canvas = await html2canvas(document.body, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#0d0221',
        scale: 2,
        useCORS: true,
        logging: false
      });

      const dataUrl = canvas.toDataURL('image/png');
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
      // 恢复 UI 显示
      uiElements.forEach((el, i) => {
        if (el && savedDisplay[i] !== null) el.style.display = savedDisplay[i];
        else if (el) el.style.display = '';
      });
    }

    if (wasSelected) selectItem(wasSelected);
  }

  // ========== 初始化 ==========
  function initUI() {
    // 工具栏按钮
    document.querySelectorAll('.item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (!type) return; // 上传按钮没有 data-type，跳过
        const item = createItem(type);
        if (item) selectItem(item);
      });
    });

    // 上传照片按钮
    const btnUpload = $('btn-upload-item');
    const fileInput = $('upload-item-file');
    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          alert('请选择图片文件');
          return;
        }

        // 先读取原图作为备用（抠图失败时使用）
        const reader = new FileReader();
        const originalDataUrl = await new Promise((resolve, reject) => {
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        showBgRemovalProgress();

        try {
          // 进行 AI 抠图
          const bgRemovedDataUrl = await removeBgFromImage(originalDataUrl);
          const item = createItem('custom', { imageUrl: bgRemovedDataUrl });
          if (item) selectItem(item);
        } catch (err) {
          console.warn('抠图失败，使用原图:', err);
          // 抠图失败时降级：直接使用原图
          const item = createItem('custom', { imageUrl: originalDataUrl });
          if (item) selectItem(item);
          alert('抠图处理失败，已使用原图。\n原因: ' + (err.message || err));
        } finally {
          hideBgRemovalProgress();
        }

        // 重置 input 以便可以重复选择同一张图
        fileInput.value = '';
      });
    }

    // 点击空白处取消选中
    pegboard.addEventListener('mousedown', (e) => {
      if (e.target === pegboard || e.target.classList.contains('pegboard-hole')) {
        deselectItem();
      }
    });

    // 重置
    $('btn-reset-view').addEventListener('click', () => {
      if (confirm('确定要清空所有物品吗？')) {
        state.items.forEach(item => {
          const el = document.getElementById(item.id);
          if (el) el.remove();
        });
        state.items = [];
        deselectItem();
      }
    });

    // 保存布局
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

    // 导入布局
    $('btn-import').addEventListener('click', openImportModal);
    $('btn-close-import').addEventListener('click', closeImportModal);
    $('btn-confirm-import').addEventListener('click', () => {
      const code = $('import-code').value.trim().toUpperCase();
      if (!code) {
        $('import-error').style.display = 'block';
        $('import-error').textContent = '请输入分享码';
        return;
      }
      const save = findSaveByCode(code);
      if (!save) {
        $('import-error').style.display = 'block';
        $('import-error').textContent = '分享码无效或未找到（仅同设备同浏览器可用）';
        return;
      }
      applySaveData(save);
      closeImportModal();
    });
    $('import-code').addEventListener('input', () => {
      $('import-error').style.display = 'none';
    });

    // 截图
    $('btn-screenshot').addEventListener('click', takeScreenshot);

    // 关闭弹窗
    $('btn-close-modal').addEventListener('click', () => {
      $('screenshot-modal').style.display = 'none';
    });

    // 属性面板：名称
    $('item-name').addEventListener('input', (e) => updateSelectedName(e.target.value));
    $('name-toggle').addEventListener('change', (e) => updateSelectedShowName(e.target.checked));

    // 属性面板：上传图片
    $('upload-image').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => applyImageToSelected(ev.target.result);
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    // 属性面板：颜色
    $('item-color').addEventListener('input', (e) => updateSelectedColor(e.target.value));

    // 属性面板：大小
    $('item-scale').addEventListener('input', (e) => updateSelectedScale(parseFloat(e.target.value)));

    // 属性面板：旋转
    $('item-rotation').addEventListener('input', (e) => updateSelectedRotation(parseFloat(e.target.value)));

    // 属性面板：阴影设置
    $('shadow-toggle').addEventListener('change', (e) => updateSelectedShadowEnabled(e.target.checked));
    $('shadow-color').addEventListener('input', (e) => updateSelectedShadowColor(e.target.value));
    $('shadow-opacity').addEventListener('input', (e) => updateSelectedShadowOpacity(parseFloat(e.target.value)));
    $('shadow-offsety').addEventListener('input', (e) => updateSelectedShadowOffsetY(parseInt(e.target.value)));
    $('shadow-blur').addEventListener('input', (e) => updateSelectedShadowBlur(parseInt(e.target.value)));

    // 属性面板：复制/删除
    $('btn-duplicate').addEventListener('click', duplicateSelected);
    $('btn-delete').addEventListener('click', deleteSelected);

    // 洞洞板设置
    $('board-color').addEventListener('input', (e) => setBoardColor(e.target.value));
    $('holes-toggle').addEventListener('change', (e) => setShowHoles(e.target.checked));
    $('hole-color').addEventListener('input', (e) => setHoleColor(e.target.value));
    $('hole-spacing').addEventListener('input', (e) => setHoleSpacing(parseInt(e.target.value)));
    $('snap-toggle').addEventListener('change', (e) => {
      CONFIG.snapEnabled = e.target.checked;
      if (!CONFIG.snapEnabled) clearSnapHints();
    });

    // 外框设置
    $('frame-toggle').addEventListener('change', (e) => setFrameEnabled(e.target.checked));
    $('frame-color').addEventListener('input', (e) => setFrameColor(e.target.value));
    $('frame-width').addEventListener('input', (e) => setFrameWidth(parseInt(e.target.value)));

    // 摄像头控制
    $('cam-rotatex').addEventListener('input', (e) => setCameraRotateX(parseFloat(e.target.value)));
    $('cam-rotatey').addEventListener('input', (e) => setCameraRotateY(parseFloat(e.target.value)));
    $('cam-zoom').addEventListener('input', (e) => setCameraZoom(parseFloat(e.target.value)));
    $('btn-reset-cam').addEventListener('click', resetCamera);

    // 光效设置
    $('light-toggle').addEventListener('change', (e) => setLightEnabled(e.target.checked));
    $('light-preset').addEventListener('change', (e) => setLightPreset(e.target.value));
    $('light-brightness').addEventListener('input', (e) => setLightBrightness(e.target.value));
    $('light-contrast').addEventListener('input', (e) => setLightContrast(e.target.value));
    $('light-saturate').addEventListener('input', (e) => setLightSaturate(e.target.value));
    $('light-tint').addEventListener('input', (e) => setLightTint(e.target.value));
    $('light-tint-amount').addEventListener('input', (e) => setLightTintAmount(e.target.value));

    // 右键拖拽旋转视角
    const container = $('pegboard-container');
    container.addEventListener('contextmenu', (e) => e.preventDefault());
    container.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // 右键
        e.preventDefault();
        state.cameraDragging = {
          startX: e.clientX,
          startY: e.clientY,
          startRotX: state.camera.rotateX,
          startRotY: state.camera.rotateY
        };
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!state.cameraDragging) return;
      const dx = e.clientX - state.cameraDragging.startX;
      const dy = e.clientY - state.cameraDragging.startY;
      const newRotY = state.cameraDragging.startRotY + dx * 0.3;
      const newRotX = state.cameraDragging.startRotX - dy * 0.3;
      setCameraRotateX(newRotX);
      setCameraRotateY(newRotY);
      $('cam-rotatex').value = state.camera.rotateX;
      $('cam-rotatey').value = state.camera.rotateY;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        state.cameraDragging = null;
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
      }
      if (e.key === 'Escape') {
        deselectItem();
      }
    });
  }

  // ========== 启动 ==========
  function start() {
    initPegboard();
    initUI();

    // 初始化外框样式
    updateFrameStyle();

    // 初始化光效
    setLightPreset(state.lighting.preset);
    applyLighting();

    // 放一些示例物品
    setTimeout(() => {
      createItem('badge',  { x: 180, y: 150, color: '#ff6b9d' });
      createItem('polaroid', { x: 320, y: 200, color: '#f5f0e6' });
      createItem('card',    { x: 500, y: 180, color: '#4fc3f7' });
      createItem('petal',   { x: 140, y: 350, color: '#ff80ab' });
      createItem('star',    { x: 620, y: 380, color: '#ffeb3b' });
      createItem('stand',   { x: 650, y: 200, color: '#ffd54f' });
      createItem('badge',   { x: 420, y: 400, color: '#b388ff' });

      // 隐藏加载
      $('loading').classList.add('hidden');
      setTimeout(() => { $('loading').style.display = 'none'; }, 600);
    }, 300);
  }

  // 暴露调试函数到全局
  window.__itawall = {
    openSaveModal,
    closeSaveModal,
    openImportModal,
    closeImportModal,
    saveLayout,
    getSaves,
    findSaveByCode,
    applySaveData,
    state
  };

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
