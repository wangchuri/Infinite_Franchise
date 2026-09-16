/**
 * Built-in page layout templates. Building one replaces the current page's
 * blocks (the author confirms first). All output passes normalizeWorldLayout.
 */
import { buildDefaultLayout, type WorldLayout } from "./world-layout";

export type LayoutTemplate = {
  id: string;
  name: string;
  description: string;
  /** Which kinds of page a template is meant for. */
  scope: "home" | "collection" | "any";
  build: () => WorldLayout;
};

function standard(): WorldLayout {
  return buildDefaultLayout();
}

function blank(): WorldLayout {
  return { version: 2, blocks: [{ id: "topbar", type: "topBar" }] };
}

function magazine(): WorldLayout {
  return {
    version: 2,
    blocks: [
      { id: "topbar", type: "topBar" },
      { id: "hero", type: "hero", props: { showTags: true } },
      {
        id: "prose",
        type: "prose",
        props: { source: "intro", title: "世界介绍" },
      },
      {
        id: "columns",
        type: "columns",
        props: { ratio: "0:1fr:300" },
        slots: {
          main: [
            {
              id: "grid-character",
              type: "entryGrid",
              props: {
                category: "character",
                title: "人物",
                withImage: true,
                style: "grid",
              },
            },
            {
              id: "grid-location",
              type: "entryGrid",
              props: {
                category: "location",
                title: "地点",
                withImage: true,
                style: "grid",
              },
            },
          ],
          right: [{ id: "infobox", type: "infoBox" }],
        },
      },
      { id: "footer", type: "footer", props: { platformButton: true } },
    ],
  };
}

function minimal(): WorldLayout {
  return {
    version: 2,
    blocks: [
      { id: "topbar", type: "topBar" },
      { id: "hero", type: "hero", props: { compact: true } },
      { id: "prose", type: "prose", props: { source: "intro", title: "" } },
      {
        id: "grid",
        type: "entryGrid",
        props: { category: "character", title: "条目", style: "list" },
      },
    ],
  };
}

function scp(): WorldLayout {
  return {
    version: 2,
    blocks: [
      { id: "topbar", type: "topBar" },
      { id: "nav", type: "nav" },
      { id: "hero", type: "hero", props: { compact: true, showTags: false } },
      { id: "prose", type: "prose", props: { source: "intro", title: "世界概述" } },
      {
        id: "grid-character",
        type: "entryGrid",
        props: { category: "character", title: "人物", style: "list" },
      },
      {
        id: "glossary",
        type: "glossary",
        props: { category: "concept", title: "概念" },
      },
      { id: "footer", type: "footer", props: { platformButton: true } },
    ],
  };
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "standard",
    name: "标准三栏",
    description: "顶栏 + 头图 + 三栏（导航 / 内容 / 信息框）",
    scope: "any",
    build: standard,
  },
  {
    id: "magazine",
    name: "杂志首页",
    description: "头图 + 双栏内容网格",
    scope: "home",
    build: magazine,
  },
  {
    id: "minimal",
    name: "极简单栏",
    description: "头图 + 介绍 + 单栏列表",
    scope: "any",
    build: minimal,
  },
  {
    id: "scp",
    name: "SCP 词条风",
    description: "侧边导航 + 概述 + 列表 + 概念",
    scope: "any",
    build: scp,
  },
  {
    id: "blank",
    name: "空白",
    description: "只保留顶栏，从零开始",
    scope: "any",
    build: blank,
  },
];
