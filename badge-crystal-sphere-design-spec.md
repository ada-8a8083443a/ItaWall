# 徽章水晶球质感升级方案

## 一、视频徽章质感分析

从视频中提取的徽章具有以下核心视觉特征：

| 特征维度 | 具体表现 |
|---------|---------|
| 形状 | 完美圆形，直径约占据屏幕 60% 宽度 |
| 材质 | 3D 水晶球 / 玻璃球体，半透明、有厚度感 |
| 高光 | 顶部弧形白色高光（模拟光源从上方照射） |
| 折射 | 内部图像被球面轻微弯曲，边缘有放大效果 |
| 边框 | 深色半透明轮廓线，增强球体立体感 |
| 投影 | 底部有柔和、模糊的投影，悬浮感 |
| 背景 | 深色（近黑），衬托球体透明质感 |

### 质感关键词
`glass sphere` · `crystal ball` · `refraction` · `specular highlight` · `drop shadow` · `depth`

---

## 二、GitHub 参考开源项目

| 项目 | Stars | 用途 | 链接 |
|------|-------|------|------|
| **css.glass** | 446 | Vue 玻璃态效果库，提供 `backdrop-filter` 最佳实践 | https://github.com/miketromba/css.glass |
| **shields** | 26,978 | 业界标准徽章生成器，SVG 徽章模板参考 | https://github.com/badges/shields |
| **GitHub-Achievements** | 5,000+ | GitHub 成就徽章完整列表，设计规范参考 | https://github.com/drknzz/GitHub-Achievements |
| **Badges4-README** | 13,343 | 多种风格徽章图标库 | https://github.com/alexandresanlim/Badges4-README.md-Profile |

> 核心参考：**css.glass** 的玻璃态实现思路 + **shields** 的 SVG 徽章结构

---

## 三、设计改进方案（可直接交给 Trae Code 实现）

### 方案 A：纯 CSS 实现（推荐，轻量）

使用多层 `box-shadow`、`radial-gradient` 和 `backdrop-filter` 模拟水晶球效果。

核心 CSS 结构：

```css
/* 水晶球外层容器 */
.crystal-badge {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  /* 底部投影 */
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 8px 16px rgba(0, 0, 0, 0.2);
}

/* 球体主体 */
.crystal-badge::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  /* 深色边框 + 内发光 */
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.6),
    inset 0 0 10px rgba(255, 255, 255, 0.1);
  z-index: 2;
  pointer-events: none;
}

/* 顶部高光弧 */
.crystal-badge::after {
  content: '';
  position: absolute;
  top: 4%;
  left: 15%;
  width: 70%;
  height: 35%;
  border-radius: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  filter: blur(2px);
  z-index: 3;
  pointer-events: none;
}

/* 内部图片 */
.crystal-badge img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  /* 球面折射效果 */
  filter: contrast(1.1) saturate(1.1);
}
```

### 方案 B：SVG 滤镜实现（更真实，稍复杂）

使用 SVG `feSpecularLighting` 和 `feDisplacementMap` 实现真正的球面折射。

核心 SVG 结构：

```html
<svg width="120" height="120" viewBox="0 0 120 120">
  <defs>
    <!-- 球面遮罩 -->
    <clipPath id="sphere-clip">
      <circle cx="60" cy="60" r="58"/>
    </clipPath>
    
    <!-- 球面高光滤镜 -->
    <filter id="sphere-highlight">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1"
        specularExponent="20" lighting-color="white" result="spec">
        <fePointLight x="40" y="20" z="80"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut"/>
    </filter>
  </defs>

  <!-- 底部投影 -->
  <ellipse cx="60" cy="115" rx="45" ry="8" fill="rgba(0,0,0,0.3)" filter="blur(6px)"/>

  <!-- 内部图片（带球面裁剪） -->
  <g clip-path="url(#sphere-clip)">
    <image href="badge-image.png" x="0" y="0" width="120" height="120"/>
  </g>

  <!-- 球面高光层 -->
  <circle cx="60" cy="60" r="58" fill="url(#highlight-gradient)" opacity="0.4"/>
  
  <!-- 顶部弧形高光 -->
  <path d="M 25 35 Q 60 10 95 35" stroke="rgba(255,255,255,0.6)" 
    stroke-width="3" fill="none" stroke-linecap="round" filter="blur(1px)"/>
</svg>
```

### 方案 C：Three.js 3D 实现（最炫酷，有性能开销）

使用 Three.js 创建真正的 3D 球体，带 `MeshPhysicalMaterial` 玻璃材质：

```js
const geometry = new THREE.SphereGeometry(1, 64, 64);
const material = new THREE.MeshPhysicalMaterial({
  transmission: 0.9,      // 透光率
  thickness: 1.5,         // 玻璃厚度
  roughness: 0.05,        // 表面光滑度
  ior: 1.5,               // 折射率
  clearcoat: 1.0,         // 清漆层
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.5,
});
const sphere = new THREE.Mesh(geometry, material);
```

---

## 四、React 组件实现建议

### 推荐文件位置
```
src/components/CrystalBadge.tsx
```

### 组件接口设计

```tsx
interface CrystalBadgeProps {
  imageUrl: string;           // 徽章内部图片
  size?: number;              // 直径，默认 120
  showHighlight?: boolean;    // 是否显示高光，默认 true
  showShadow?: boolean;       // 是否显示投影，默认 true
  borderColor?: string;       // 边框颜色，默认 rgba(255,255,255,0.08)
  className?: string;
}
```

### 使用方式

```tsx
<CrystalBadge
  imageUrl="/badges/first-checkin.png"
  size={120}
  showHighlight={true}
  showShadow={true}
/>
```

---

## 五、改进前后对比预期

| 维度 | 当前（推测） | 改进后 |
|------|------------|--------|
| 立体感 | 扁平圆形 | 3D 水晶球体 |
| 材质感 | 纯色/普通图片 | 玻璃折射 + 高光 |
| 视觉层次 | 单层 | 多层叠加（投影 + 图片 + 高光 + 边框） |
| 品牌感 | 普通 | 高端艺术品展示感 |

---

## 六、给 Trae Code 的 Prompt

你可以直接复制以下内容发给 Trae Code：

```
请帮我实现一个 CrystalBadge 组件，用于展示用户获得的成就徽章。

设计要求（参考 EchoDraw 应用的水晶球效果）：
1. 圆形徽章，3D 水晶球质感
2. 顶部有弧形白色高光（模拟光源）
3. 底部有柔和投影，营造悬浮感
4. 边缘有半透明深色轮廓
5. 内部图片有轻微球面折射效果
6. 背景深色时效果最佳

技术约束：
- 使用 React + TypeScript + Tailwind CSS
- 优先用纯 CSS 实现（方案 A），如果效果不够好再用 SVG 方案
- 组件需支持 size、showHighlight、showShadow 等 props
- 需要适配深色和浅色两种主题背景

请生成 CrystalBadge.tsx 组件文件和对应的样式代码。
```
