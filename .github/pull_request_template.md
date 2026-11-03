<!--
合并规则：main 只能通过 PR 合并，且不允许 merge commit。
合并时请选 “Squash and merge”（或 Rebase and merge），不要选 “Create a merge commit”。
-->

## 做了什么
<!-- 一两句话 -->

## 与计划不同的地方
<!-- 没有就写“无” -->

## 依赖
<!-- 需要先合并的 PR，例如“依赖 #5”；没有就写“无” -->

## 验证
- [ ] `python web/build_js.py` 通过
- [ ] 一致性测试 `make_specs.py` → `py_run.py` → `node web/test/js_run.js`：**ok 292 bad 0**（数量变了请写明）
- [ ] `python build_viewer.py` 全部“通过”
- [ ] 按改动范围加跑（不涉及的删掉）：
  - [ ] church.js / gothic.js：教区教堂 1792 组合方块哈希不变
  - [ ] cathedral.js：预设 × 关键开关 + checkPlacement 0 处；默认 200 种子 `adjust` 为空
  - [ ] green.js：每个内置配方 200 种子 0 提示；局部重算 = 全量重算
  - [ ] town.js / district.js：不开新选项时街区方块哈希不变
  - [ ] template.html：Playwright 三手柄（缩放 / 旋转 / 移动）+ 撤销；状态栏无 ⚠
  - [ ] 导出 / 目标版本：每档导出的方块名都在该版本里存在

## 提交前自查
- [ ] 分支从最新 main 开出；一个 PR 只做一件事
- [ ] 没有提交打包文件：`web/mcgen.js`、`web/mcgen_data.json`、`viewer/index.html`、`viewer/compare.html`、`web/test/py.json`、`out/`
- [ ] 新 `web/src/*.js` 只有在加载时依赖别的文件常量（或被依赖）才加进 `web/build_js.py` 的 `ORDER`
- [ ] 新顶层名已 grep，无重名
- [ ] 改大文件前已备份到 `_backup/vNN/`
- [ ] 和 main 冲突时：在本分支 `git merge origin/main`；打包文件冲突一律删除；`build_js.py` 以 main 为准；解决后重跑上面的验证

## 制作清单
<!-- 改了 docs/mcgen_制作清单.xlsx 的哪几行；没有就写“无” -->
