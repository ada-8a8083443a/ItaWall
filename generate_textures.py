"""
生成真实感徽章和拍立得纹理（PNG，带透明背景）
v2 - 修复中间透明区域，增强真实感
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os
import random

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'textures')
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZE = 1024


def rounded_rect(draw, x1, y1, x2, y2, r, **kwargs):
    """绘制圆角矩形"""
    draw.rectangle([x1+r, y1, x2-r, y2], **kwargs)
    draw.rectangle([x1, y1+r, x2, y2-r], **kwargs)
    draw.pieslice([x1, y1, x1+2*r, y1+2*r], 180, 270, **kwargs)
    draw.pieslice([x2-2*r, y1, x2, y1+2*r], 270, 360, **kwargs)
    draw.pieslice([x1, y2-2*r, x1+2*r, y2], 90, 180, **kwargs)
    draw.pieslice([x2-2*r, y2-2*r, x2, y2], 0, 90, **kwargs)


def generate_badge_texture():
    """生成真实感徽章纹理：金色金属边框 + 中间完全透明"""
    cx, cy = SIZE // 2, SIZE // 2
    outer_r = SIZE // 2 - 40
    inner_r = int(outer_r * 0.78)

    # 最终图层（完全透明开始）
    final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

    # ========== 1. 整体阴影 ==========
    shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    off = 15
    sdraw.ellipse([40+off, 40+off, SIZE-40+off, SIZE-40+off], fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=30))
    final = Image.alpha_composite(final, shadow)

    # ========== 2. 金属主体（环形） ==========
    # 用 mask 方式：先画满圆，再挖空中间
    metal = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    mdraw = ImageDraw.Draw(metal)

    # 外圈金色渐变（从左上亮到右下暗，模拟光照）
    for i in range(outer_r, inner_r, -1):
        t = (outer_r - i) / (outer_r - inner_r)
        # 颜色随角度变化（模拟曲面反射）
        angle_factor = 1.0
        r = int(255 - 30 * t)
        g = int(210 - 50 * t)
        b = int(90 + 30 * t)
        mdraw.ellipse([cx-i, cy-i, cx+i, cy+i], fill=(r, g, b, 255))

    # 金属拉丝纹理（只作用于环形区域）
    ring_mask = Image.new('L', (SIZE, SIZE), 0)
    rmdraw = ImageDraw.Draw(ring_mask)
    rmdraw.ellipse([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r], fill=255)
    rmdraw.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=0)

    mpixels = metal.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if ring_mask.getpixel((x, y)) > 128:
                r, g, b, a = mpixels[x, y]
                n = random.randint(-25, 25)
                mpixels[x, y] = (
                    max(0, min(255, r + n)),
                    max(0, min(255, g + n)),
                    max(0, min(255, b + n)),
                    a
                )

    # 挖空中间（alpha 设为 0）
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy < inner_r * inner_r:
                r, g, b, a = mpixels[x, y]
                mpixels[x, y] = (r, g, b, 0)

    final = Image.alpha_composite(final, metal)

    # ========== 3. 高光（顶部光源反射） ==========
    highlight = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)

    # 顶部宽高光
    for i in range(80):
        alpha = int(200 * (1 - i/80) ** 1.5)
        off = int(i * outer_r / 100)
        hdraw.arc(
            [cx-outer_r+off, cy-outer_r+off, cx+outer_r-off, cy+outer_r-off],
            25, 155, fill=(255, 255, 255, alpha), width=2
        )

    # 右下侧环境反光（冷色调）
    for i in range(50):
        alpha = int(120 * (1 - i/50))
        off = int(i * outer_r / 70)
        hdraw.arc(
            [cx-outer_r+off, cy-outer_r+off, cx+outer_r-off, cy+outer_r-off],
            195, 315, fill=(180, 210, 255, alpha), width=2
        )

    highlight = highlight.filter(ImageFilter.GaussianBlur(radius=2))
    # 高光也只保留环形区域
    hpixels = highlight.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if ring_mask.getpixel((x, y)) < 128:
                r, g, b, a = hpixels[x, y]
                hpixels[x, y] = (r, g, b, 0)
    final = Image.alpha_composite(final, highlight)

    # ========== 4. 内圈边缘高光 ==========
    edge_light = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    edraw = ImageDraw.Draw(edge_light)
    for i in range(20):
        alpha = int(220 * (1 - i/20) ** 1.2)
        r = inner_r - i * 0.6
        if r > 0:
            edraw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(255, 255, 255, alpha))
    edge_light = edge_light.filter(ImageFilter.GaussianBlur(radius=1))
    final = Image.alpha_composite(final, edge_light)

    # ========== 5. 内圈阴影（凹陷感） ==========
    inner_shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    isdraw = ImageDraw.Draw(inner_shadow)
    for i in range(30):
        alpha = int(150 * (1 - i/30) ** 1.5)
        r = inner_r + i * 0.8
        isdraw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(0, 0, 0, alpha))
    inner_shadow = inner_shadow.filter(ImageFilter.GaussianBlur(radius=3))
    final = Image.alpha_composite(final, inner_shadow)

    # ========== 最后强制挖空中间区域（确保完全透明） ==========
    fpixels = final.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy < inner_r * inner_r:
                r, g, b, a = fpixels[x, y]
                fpixels[x, y] = (r, g, b, 0)

    # ========== 保存 ==========
    final.save(os.path.join(OUTPUT_DIR, 'badge.png'), 'PNG')
    print(f'✅ 徽章纹理: {SIZE}x{SIZE}')
    # 验证
    print(f'   中心点透明度: {final.getpixel((cx, cy))[3]} (应为0)')
    print(f'   边框点透明度: {final.getpixel((50, cy))[3]} (应为255)')


def generate_polaroid_texture():
    """生成真实感拍立得纹理：白色相纸边框 + 中间照片区透明"""
    w, h = 1024, 1280
    cx = w // 2

    # 边框参数
    border_l = 55
    border_r = 55
    border_t = 55
    border_b = 285
    photo_x1 = border_l
    photo_y1 = border_t
    photo_x2 = w - border_r
    photo_y2 = int(h * 0.72)
    photo_w = photo_x2 - photo_x1
    photo_h = photo_y2 - photo_y1
    corner_r = 28

    # 照片区遮罩（1=边框，0=照片区透明）
    border_mask = Image.new('L', (w, h), 255)
    bmdraw = ImageDraw.Draw(border_mask)
    rounded_rect(bmdraw, photo_x1, photo_y1, photo_x2, photo_y2, corner_r - 8, fill=0)

    final = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    # ========== 1. 整体阴影 ==========
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    off = 18
    rounded_rect(sdraw, off, off, w-off, h-off, corner_r, fill=(0, 0, 0, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=35))
    final = Image.alpha_composite(final, shadow)

    # ========== 2. 白色相纸主体 ==========
    paper = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(paper)

    # 基础白色（偏暖）
    rounded_rect(pdraw, 0, 0, w, h, corner_r, fill=(250, 248, 240, 255))

    # 顶部稍亮
    top_glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    tgdraw = ImageDraw.Draw(top_glow)
    for i in range(h // 3):
        alpha = int(90 * (1 - i / (h // 3)) ** 1.3)
        tgdraw.line([0, i, w, i], fill=(255, 255, 255, alpha))
    paper = Image.alpha_composite(paper, top_glow)

    # 底部稍暗
    bottom_dark = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bddraw = ImageDraw.Draw(bottom_dark)
    for i in range(h // 2):
        y = h - i
        alpha = int(70 * (i / (h // 2)) ** 1.2)
        bddraw.line([0, y, w, y], fill=(0, 0, 0, alpha))
    paper = Image.alpha_composite(paper, bottom_dark)

    # 纸张纤维噪点
    ppixels = paper.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = ppixels[x, y]
            if a > 0:
                n = random.randint(-18, 18)
                ppixels[x, y] = (
                    max(0, min(255, r + n)),
                    max(0, min(255, g + n)),
                    max(0, min(255, b + n)),
                    a
                )

    # 挖空照片区
    for y in range(h):
        for x in range(w):
            if border_mask.getpixel((x, y)) < 128:
                r, g, b, a = ppixels[x, y]
                ppixels[x, y] = (r, g, b, 0)

    final = Image.alpha_composite(final, paper)

    # ========== 3. 照片区内阴影（凹陷感） ==========
    recess = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(recess)
    # 深色底
    rounded_rect(rdraw, photo_x1 - 2, photo_y1 - 2, photo_x2 + 2, photo_y2 + 2,
                 corner_r - 6, fill=(15, 12, 8, 255))
    # 柔化内阴影
    for i in range(40):
        alpha = int(140 * (1 - i/40) ** 1.5)
        shrink = i * 1.2
        rounded_rect(rdraw,
            photo_x1 + shrink, photo_y1 + shrink,
            photo_x2 - shrink, photo_y2 - shrink,
            max(4, corner_r - 10 - shrink // 2),
            outline=(0, 0, 0, alpha))
    recess = recess.filter(ImageFilter.GaussianBlur(radius=3))
    # 只保留照片区
    rpixels = recess.load()
    for y in range(h):
        for x in range(w):
            if border_mask.getpixel((x, y)) > 128:
                r, g, b, a = rpixels[x, y]
                rpixels[x, y] = (r, g, b, 0)
    final = Image.alpha_composite(final, recess)

    # ========== 4. 照片区边缘高光 ==========
    photo_edge = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pedraw = ImageDraw.Draw(photo_edge)
    for i in range(10):
        alpha = int(180 * (1 - i/10))
        rounded_rect(pedraw,
            photo_x1 - 1 + i, photo_y1 - 1 + i,
            photo_x2 + 1 - i, photo_y2 + 1 - i,
            corner_r - 8, outline=(255, 255, 255, alpha))
    photo_edge = photo_edge.filter(ImageFilter.GaussianBlur(radius=1))
    final = Image.alpha_composite(final, photo_edge)

    # ========== 5. 底部手写区（横线） ==========
    write_y1 = photo_y2 + 35
    write_y2 = h - 45
    write_area = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    wadraw = ImageDraw.Draw(write_area)
    # 稍深的米色底
    wadraw.rectangle([photo_x1, write_y1, photo_x2, write_y2],
                     fill=(245, 240, 225, 160))
    # 手写横线
    for i in range(1, 6):
        y = write_y1 + int((write_y2 - write_y1) * i / 6)
        wadraw.line([photo_x1 + 20, y, photo_x2 - 20, y],
                    fill=(170, 155, 120, 140), width=2)

    # 只保留边框区域
    wapixels = write_area.load()
    for y in range(h):
        for x in range(w):
            if border_mask.getpixel((x, y)) < 128:
                r, g, b, a = wapixels[x, y]
                wapixels[x, y] = (r, g, b, 0)
    final = Image.alpha_composite(final, write_area)

    # ========== 6. 外边缘高光 ==========
    outer_highlight = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ohdraw = ImageDraw.Draw(outer_highlight)
    for i in range(15):
        alpha = int(130 * (1 - i/15))
        rounded_rect(ohdraw, i, i, w-i, h-i, corner_r, outline=(255, 255, 255, alpha))
    outer_highlight = outer_highlight.filter(ImageFilter.GaussianBlur(radius=2))
    final = Image.alpha_composite(final, outer_highlight)

    # ========== 最后强制挖空照片区（确保完全透明） ==========
    fpixels = final.load()
    for y in range(h):
        for x in range(w):
            if border_mask.getpixel((x, y)) < 128:
                r, g, b, a = fpixels[x, y]
                fpixels[x, y] = (r, g, b, 0)

    # ========== 保存 ==========
    final.save(os.path.join(OUTPUT_DIR, 'polaroid.png'), 'PNG')
    print(f'✅ 拍立得纹理: {w}x{h}')
    print(f'   照片区透明度: {final.getpixel((cx, photo_y1 + 50))[3]} (应为0)')
    print(f'   边框透明度: {final.getpixel((50, 50))[3]} (应为255)')


if __name__ == '__main__':
    print('🎨 正在生成真实感纹理 v2...\n')
    generate_badge_texture()
    print()
    generate_polaroid_texture()
    print('\n🎉 完成！')
