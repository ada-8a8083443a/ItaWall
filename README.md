# 赛博痛墙 - Cyber Ita Wall

一个基于 Three.js 的纯前端 3D 痛墙装扮系统。二次元爱好者和追星族可以在这个赛博空间里自由装扮自己的虚拟痛墙。

## ✨ 功能特性

- 🏷️ **6种装饰物**：徽章、拍立得、卡片、立牌、花瓣、星星
- 🖼️ **自定义图片**：上传你喜欢的角色照片、偶像图片等
- 🎨 **颜色定制**：装饰物颜色、墙面颜色、边框颜色自由搭配
- 🎯 **自由拖拽**：左键拖拽物品到任意位置
- 📐 **大小旋转**：调整物品尺寸和旋转角度
- 🌐 **视角调节**：右键拖拽旋转视角，滚轮缩放
- 💡 **物理光照**：真实的光影效果，赛博朋克风格灯光
- 📸 **拍照保存**：一键截图下载你的赛博痛墙作品
- 📱 **响应式**：适配桌面和移动设备

## 🛠️ 技术栈

- **Three.js r160** - 3D 渲染引擎（CDN 引入）
  - OrbitControls - 视角控制
  - DragControls - 物体拖拽
- **html2canvas** - 截图功能（CDN 引入）
- **纯前端** - 无需构建工具，开箱即用

## 📁 项目结构

```
赛博痛墙/
├── index.html          # 主页面
├── css/
│   └── style.css       # 赛博朋克风格样式
├── js/
│   └── main.js         # 核心逻辑（场景/物品/交互/光照）
├── .htaccess           # Apache 部署配置
├── start.bat           # Windows 本地启动脚本
└── README.md
```

## 🚀 快速开始

### 方式一：直接打开（最简单）
双击 `index.html` 即可在浏览器中运行。

### 方式二：本地 HTTP 服务器（推荐）
由于某些浏览器对本地文件有安全限制，建议启动本地服务器：

**Windows：**
双击运行 `start.bat`（需要 Python 3）

或者手动执行：
```bash
# Python 3
python -m http.server 8080

# 或 Node.js
npx serve
```

然后访问 `http://localhost:8080`

## 🖥️ Apache HTTP Server 部署

### 1. 复制文件
将整个项目目录复制到 Apache 的 htdocs 目录下，例如：
```
C:\Apache24\htdocs\cyber-ita-wall\
```

### 2. 配置虚拟主机（可选）
在 Apache 的 `httpd.conf` 或 `extra/httpd-vhosts.conf` 中添加：

```apache
<VirtualHost *:80>
    ServerName cyber-ita-wall.local
    DocumentRoot "C:/Apache24/htdocs/cyber-ita-wall"
    <Directory "C:/Apache24/htdocs/cyber-ita-wall">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### 3. 重启 Apache
访问 `http://localhost/cyber-ita-wall/` 或配置的域名即可。

> 项目已包含 `.htaccess` 文件，配置了正确的 MIME 类型和缓存策略。

## 🎮 使用说明

| 操作 | 说明 |
|------|------|
| **左键拖拽物品** | 移动装饰物位置 |
| **右键拖拽空白** | 旋转摄像头视角 |
| **滚轮** | 缩放画面 |
| **点击物品** | 选中并打开属性面板 |
| **ESC** | 取消选中 |

### 工作流
1. 点击左侧「添加物品」选择装饰物类型
2. 点击物品打开右侧属性面板
3. 上传自定义图片（徽章/拍立得/卡片/立牌支持）
4. 调整颜色、大小、旋转角度
5. 用左键拖拽摆放位置
6. 右键旋转到满意的角度
7. 点击「📸 拍照保存」下载作品

## 🌐 浏览器兼容性

- Chrome 90+ ✅
- Firefox 88+ ✅
- Edge 90+ ✅
- Safari 14+ ✅

需要支持 WebGL 的现代浏览器。

## 📜 License

MIT License - 自由使用、修改、分发。

## 🤝 致谢

- [Three.js](https://threejs.org/) - 强大的 WebGL 3D 引擎
- [html2canvas](https://html2canvas.hertzen.com/) - 截图库
