# 文艺复兴式教堂

入口：网页编辑器的“组件 → 地标 → 主教座堂 → 风格 → 文艺复兴式”。布局资产库的“地标”也包含同一组件。

默认建筑尺寸：113 × 75 格、总高 85 格、66,022 个建筑方块。网页预览附加的草地不属于建筑；组件导出时会排除这些草地，并遵循组件旋转方向。布局模式仍导出整个当前场景。

山花纹章和穹顶材质分带为建筑固定造型。

## 支持的参数

| 参数 | 默认值 | 作用 |
|---|---|---|
| `nave_width` | `27` | 23–35的奇数，中殿宽（含墙）；同步移动墙、拱廊、上层立面，并重建中殿屋顶 |
| `body_height` | `27` | 25–39的整数，从室内地面 y=3 到中殿墙顶；墙身与柱身增减，檐口、屋顶和上部构件升降 |
| `nave_extra_bays` | `0` | 0–3 个完整中殿开间，每间 9 格；不对方块模型进行拉伸缩放 |
| `roof` | `terracotta` | `terracotta` 红陶与砖、`slate` 深板岩、`copper` 铜绿 |
| `walls` | `warm` | `warm` 暖色砂岩、`ivory` 象牙白 |
| `glass` | `gray` | `gray` 淡灰、`clear` 透明、`amber` 琥珀、`colored` 彩色混合 |
| `seed` | `1` | -999999–999999 的整数；仅改变彩色玻璃分布，不改变建筑轮廓 |
| `interior` | `true` | 祭坛与长椅 |

```js
const result = MCGen.cathedral({
  style: 'renaissance',
  nave_extra_bays: 1,
  roof: 'copper',
  walls: 'ivory',
  glass: 'colored',
  seed: 37,
  interior: true,
});
```

组件与布局中的长轴手柄调节新增开间，宽轴手柄调节中殿宽，竖轴手柄调节主体墙高。中殿变宽时侧廊净宽减少，变窄则相反；外侧廊、耳堂、后殿和穹顶保持各自的跨度。默认27格宽、27格墙高的方块模型与开放尺寸前完全一致。旧风格使用的双塔、飞扶壁、侧廊数量等控件在本风格中隐藏。

支持保存为组件预设，以及在布局中放置、旋转、编辑单栋参数和保存布局工程。返回的有效 `spec` 可用于重新生成相同模型。

## 源码与构建

- `web/src/renaissance.js`：独立风格构建、参数归一化和材质预设。
- `viewer/cathedral-style-controls.js`：参数分组、布局编辑、长轴手柄和组件导出。
- `web/src/cathedral.js`：仅新增该风格的分派分支。
- `build_viewer.py`：嵌入专用控件脚本。

运行 `python build_viewer.py` 生成 `viewer/index.html`。在网页地址加 `?style=renaissance` 可直接进入此风格。无需外部网站或 npm 依赖。

此接入覆盖网页编辑器和 JavaScript 组件接口；其他风格继续使用原有构建器。
