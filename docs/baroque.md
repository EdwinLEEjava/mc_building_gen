# 巴洛克式教堂

巴洛克已接入原有主教座堂的 JavaScript 生成入口、网页组件参数、街区物件编辑和 Python `generate.py` 入口。
模型采用与其他主教座堂一致的西向正门（-X）；默认宽高长为 139 × 99 × 121 格，包含自带石质基座，共 220,246 个非空气方块。

## 网页

先在工程根目录运行：

```powershell
python -X utf8 build_viewer.py
```

打开 `viewer/index.html`，选择 **组件 → 地标 → 主教座堂 → 巴洛克式**。
也可用 `viewer/index.html?style=baroque` 直接打开巴洛克。网页为自包含文件，生成与导出可离线使用。

网页显示“平面、剖面高度、材质预设和室内”，隐藏不适用于该风格的哥特式参数。切换回其他风格后，原来的控件恢复。
画布中的长轴手柄调整新增中殿开间，宽轴手柄调整中殿宽，竖轴手柄调整主体墙高。

| 参数 | 范围 | 实际作用 |
| --- | --- | --- |
| `nave_width` | 33–49 的奇数，默认41 | 中殿宽（含墙）；移动中殿墙、拱廊、支柱，重建中殿与侧廊屋顶、桶形拱顶 |
| `body_height` | 32–46 的整数，默认34 | 从室内地面 y=6 到中殿墙顶的高度；增减墙身、柱身，并升降檐口、屋顶和上部构件 |
| `extra_bays` | 0–3 的整数 | 每增加一开间，增加14格完整的中殿、侧廊、窗、柱、屋顶及基座 |
| `seed` | 整数 | 改变墙面浮雕图案与钟面指针；主要体量保持不变 |
| `roof` | `copper` / `slate` | 铜绿或深板岩屋顶，含对应楼梯方块 |
| `walls` | `sandstone` / `ivory` | 暖黄砂岩或象牙白墙体与基座 |
| `interior` | `true` / `false` | 长椅与祭坛家具；关闭后仍保留拱廊、拱顶和建筑外壳 |

建议先用默认造型；想拉长体量时将新增开间设为1，再逐项比较。种子不是建筑大小控制项。
中殿变宽会压缩两侧侧廊的净宽，变窄则相反；外侧廊、耳堂、穹顶和塔楼各自的跨度保持不变。默认41格宽、34格墙高的方块模型与开放尺寸前完全一致。旧教堂的高侧窗高度、尖塔林等不适用参数仍隐藏。

右上角“导出 .schem”会导出当前完整建筑和自带基座，不包含组件预览额外铺设的草地、泥土；剖切不截断导出。
目标游戏版本仍由原来的下拉框控制，其他风格继续使用原来的导出行为。

## Python 入口

巴洛克使用与网页相同的 JavaScript 构建内核，因此这一个风格需要 **Node.js**（无 npm 依赖）。
其他 Python 民居的生成路径不需要 Node.js，也没有改变。

```powershell
python -X utf8 generate.py specs/baroque.json out/baroque.schem
```

参数示例：

```json
{
  "type": "cathedral",
  "style": "baroque",
  "seed": 1,
  "nave_width": 41,
  "body_height": 34,
  "extra_bays": 0,
  "interior": true,
  "roof": "copper",
  "walls": "sandstone"
}
```

默认 Python 导出使用 DataVersion 3465（Java 1.20.1）。可通过 `game_version` 指定网页支持的目标版本 ID，例如 `1.20.3`、`1.21`、`1.21.4`、`1.21.5`；未知版本会明确报错。
若系统找不到 `node`，可用环境变量 `MCGEN_NODE` 指向 Node.js 可执行文件。

Python 中也可取得普通 `Structure`：

```python
from mcgen.baroque import build_baroque

structure = build_baroque({"seed": 9, "extra_bays": 1})
structure.save_schem("out/baroque.schem", data_version=3465)
```

JavaScript 接口：

```javascript
const M = require('./web/mcgen.js');
const result = M.cathedral({style: 'baroque', seed: 1, extra_bays: 0});
// result.S / spec / report / foot / tags / adjust / placement
```

## 代码与验证

- `web/src/baroque.js`：建筑和原工程坐标适配；加入后由现有构建脚本自动打包。
- `viewer/cathedral-style-controls.js`：专用控件、风格切换、尺寸手柄、街区编辑及组件导出适配。
- `web/baroque_cli.cjs`、`mcgen/baroque.py`：Python 与同一个构建内核之间的接口。
- `specs/baroque.json`：默认参数。

构建后可通过上面的网页、Python CLI 和 JavaScript 接口生成同一组参数，核对模型与 schematic 导出。既有民居一致性检查仍使用 `web/test/make_specs.py` → `web/test/py_run.py` → `node web/test/js_run.js`。
接入时已对比八种旧教堂风格的24组输出，以及三组 Python 民居，方块和原有报告保持一致。
已验证网页默认及组合参数导出与 Python 输出逐格一致；实际游戏客户端粘贴尚未测试。

大型地标局部更新时，原有数组展开可能超过 JavaScript 调用参数上限。共用 `retouchTown` 的两处记录追加已改为迭代追加，建筑构建规则未变；旧拜占庭街区更新前后的方块、边界和检查结果已与接入前逐项对比一致。
