import type { Metadata } from "next";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Wiki 接口文档 · 无限企划",
};

function Code({ children }: { children: string }) {
  return <pre className={styles.code}>{children}</pre>;
}

export default function WikiDocsPage() {
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Wiki Schema</p>
        <h1>给 Agent 与手写 HTML 的接口</h1>
        <p className={styles.lead}>
          自定义 HTML 区块与区域卡片都在<b>沙箱 iframe</b> 中运行；平台把当前世界的数据以{" "}
          <code>window.WORLD</code> 注入，你只需写 HTML / CSS。
        </p>
      </header>

      <section className={styles.section}>
        <h2>window.WORLD</h2>
        <Code>{`{
  world:       { id, name, slug, tagline, description, tags[], logoUrl, coverUrl, wikiBackgroundUrl },
  entries:     [Entry],                 // 本世界全部词条
  categories:  { [归属key]: [Entry] },   // 按归属分组
  collections: [Collection],            // 归属元数据
  timeline:    [{ id, title, description, eventDate }],
  works:       [{ id, title, summary, category, kind, worldSlug, authorDisplayName }]
}

// Entry
{ id, category, title, slug, aliases[], content, imageUrl, attributes: { [key]: value } }

// Collection（归属）
{ key, name, iconUrl, color, attrFields: [{ key, label }] }`}</Code>
        <p className={styles.note}>
          词条详情链接：<code>/w/&#123;world.slug&#125;/entry/&#123;entry.slug&#125;</code>；
          归属页：<code>/w/&#123;world.slug&#125;/c/&#123;collection.key&#125;</code>。
        </p>
      </section>

      <section className={styles.section}>
        <h2>区域卡片模板（元组件）</h2>
        <p>在「区域卡片」的 HTML 模板里可用这些占位符，平台会为每个词条渲染一次：</p>
        <Code>{`{{title}} {{slug}} {{url}} {{excerpt}} {{imageUrl}} {{content}}
{{attr.额外属性key}}    // 来自词条编辑里为该归属添加的额外属性
{{prop.自定义字段key}}  // 该卡片「额外属性」中定义的字段`}</Code>
        <p className={styles.note}>
          卡片可按属性匹配：<code>attr.字段 等于 / 不等于 / 包含 值</code>。多个卡片时，
          第一个命中的生效，否则用“默认卡片”。内置 box（宽高 / 背景 / 圆角 / 透明度）优先级最低，
          你的 CSS 与「页面 CSS」都会覆盖它。
        </p>
      </section>

      <section className={styles.section}>
        <h2>布局 JSON（导入 / 导出）</h2>
        <p>
          编辑器顶部有「导出本页 / 导出世界 / 导入」。页文件结构：
        </p>
        <Code>{`{
  "format": "infinite-franchise/wiki-page",
  "version": 1,
  "kind": "home" | "collection" | "custom",
  "collectionKey": string | null,
  "title": string, "slug": string,
  "css": string,
  "layout": { "version": 2, "theme": {…}, "blocks": [Block, …] }
}

// Block
{ "id": string, "type": string, "props": {…}, "slots": { [槽名]: [Block, …] } }`}</Code>
        <p className={styles.note}>
          常用 <code>type</code>：<code>topBar / hero / columns / bgRegion / footer</code>、
          <code>nav / navGrid / prose / entryGrid / glossary / timeline / workList / infoBox</code>、
          <code>heading / text / richText / image / gallery / quote / divider / button / linkList / relatedEntries</code>、
          <code>customHtml</code>。导入时会重新校验：未知 type 与非法属性会被丢弃。
          任何区块都支持 <code>props.hideOnMobile = true</code>，在窄屏（≤640px）隐藏。
        </p>
      </section>

      <section className={styles.section}>
        <h2>页面 CSS</h2>
        <p>
          每页可写自定义 CSS，已做安全过滤（禁 <code>@import</code>、<code>expression</code>、
          <code>javascript:</code>、<code>@scope</code>），渲染时自动包进{" "}
          <code>@scope (#wiki-root)</code>，不会泄漏到平台界面；同时会下发到区域沙箱。
        </p>
        <p className={styles.note}>
          注意：页面 CSS <b>按页保存</b>——首页与每个归属页各自独立，切换页签时编辑框显示的是该页自己的值。
        </p>
      </section>

      <section className={styles.section}>
        <h2>限制</h2>
        <ul className={styles.list}>
          <li>HTML 在沙箱中运行（无 same-origin），不能读取登录态或访问平台 DOM。</li>
          <li>区块属性为字符串/数字/布尔，单字段有长度上限。</li>
          <li>单个页面区块数量、嵌套深度、卡片数量均有上限。</li>
        </ul>
      </section>
    </article>
  );
}
