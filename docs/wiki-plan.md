# Wiki 界面的规划（排版编辑器重做）

> 状态：Phase 0/1/2 完成 · Phase 3 待做
> 相关：`docs/features.md`、`docs/design.md`

## 1. 三层模型与术语

| 层 | 是什么 | 代码 | 对外叫法 |
| --- | --- | --- | --- |
| 资料层（数据） | 世界里有什么：词条 + 归属（+ 时间线、作品） | `wiki_entries` / `collections` / `timeline` | **世界观内容** / 词条 / 归属 |
| 呈现层（页面） | 把资料渲染成可读页面：Wiki 主页 + 词条页 + 归属页 | `world_pages` / `world_layout` / `homepage_config` / `EntryLayout` | **Wiki**（门面） |
| 编辑入口 | 分别进两层的门 | `wiki-hub` → `entries` / `wiki` | **编辑词条** ｜ **编辑 Wiki 界面** |

原则：
- `Wiki` 一词**只指呈现层**，不再用来指词条数据。
- 数据/创建层统一叫 词条 / 归属 / 词条库。
- 公开侧：`/w/[slug]`（世界主页：作品/讨论）与 `/w/[slug]/wiki`（Wiki 门面：设定）**并存**。
- 内部名（表 `wiki_entries`、类型 `WikiEntry`、路由段）保持不变，改名只动文案。

## 2. 需求与落点

1. **多个背景图区域** —— 把"背景"做成一等块（多区域，各带图/渐变/透明度）。
2. **元组件属性** —— 组件内置属性：背景图、尺寸（宽高）、默认图片；额外属性来自词条编辑（只有词条里加过的属性才可选）；多变体按属性显示不同样式；支持 CSS，CSS 覆盖内置设置。
3. **整体色调/透明度 + 自定义 CSS** —— 世界/页面级 CSS，作用于该世界容器。
4. **富文本** —— 图文混排 + HTML，所见即所得与源码双模式。
5. **对 Agent / HTML 友好** —— 正式化 `window.WORLD` 数据接口 + 文档 + 上传 HTML。
6. **归属页可编辑** —— 每个归属有自己的页面，用同一套组件。

## 3. 补充项（架构约束）

- **A. 页面模型**：`world_pages`（`kind = home | collection | custom`）。现有 `world_layout` 迁移为 home 页。
- **B. 优先级链**：`内置默认 → 组件内置属性 → 变体属性值 → 变体 CSS → 页面/世界级 CSS → 组件自定义 CSS`，后者覆盖前者。
- **C. 安全**：HTML 走沙箱 iframe；世界/页面 CSS 强制作用域 + 危险语法校验；富文本 HTML sanitize。
- **D. 数据接口**：`window.WORLD` 补全 `attributes` / `collections`，并出 JSON Schema 文档。
- **E. 版本/回滚**：保存留最近 N 个快照。
- **F. 其他**：响应式断点；世界素材库；权限（creator/editor）；iframe 懒加载与限流。

## 4. 分阶段

### Phase 0（地基）
- 0a 正名：编辑页 / wiki-hub / WikiTiles / 阅读页右栏 / `nav-trail` / 排版编辑器顶栏文案。
- 0b `world_pages` 迁移（home/collection/custom + 从 `world_layout` 回填 home）。
- 0b 后端 pages 服务与路由；世界 payload 带 pages。
- 0b 前端接入：公开 Wiki 读 home page；排版编辑器改用 page API。

### Phase 1（核心）— ✅ 已完成
- 页面级 CSS（`world_pages.css`）：前后端 `sanitizePageCss` + 公开页 `@scope (#wiki-root)` 注入 + 编辑器「页面 CSS」面板。
- 元组件内置属性：`BlockVariant.box`（宽/高/背景图/背景色/圆角/透明度）+ `defaultImage`；优先级 内置 box < 页面 CSS < 变体 CSS。
- 多背景区域块 `bgRegion`（背景图/渐变/暗色遮罩/最小高度/内边距/固定视差，含 content 子槽）。
- 归属页可编辑：编辑器页面切换（首页 + 各归属），公开 `/w/[slug]/c/[key]` 渲染归属页布局。

### Phase 2（富文本 / HTML）— ✅ 已完成
- `richText` 块：所见即所得工具栏（粗/斜/下划线/标题/列表/引用/链接/图片）+ HTML 源码双模式。
- 安全：渲染端 DOMParser 白名单（标签/属性/URL），后端正则兜底；`customHtml` 仍原样跑在沙箱里。
- `customHtml` 支持上传 `.html` / `.css` 文件。
- `window.WORLD` 补全（词条 `aliases`/`attributes`、`collections` 元数据）+ 文档页 `/docs/wiki`。

### Phase 3（生态）
- layout 导入/导出（Agent 友好）、模板/一键套用、版本回滚、响应式、素材库。

## 5. 已定的关键决策

| 决策 | 结论 |
| --- | --- |
| 多页面存储 | 新建 `world_pages` 表 |
| 归属页内容 | 以本归属词条为主，可混排其他区域 |
| CSS/HTML 安全 | 作用域 + 校验；HTML 沙箱；富文本 sanitize |
| 富文本路线 | 所见即所得 + HTML 源码双模式 |
| 起步 | 先 Phase 0 |
