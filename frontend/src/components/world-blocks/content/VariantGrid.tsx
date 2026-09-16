"use client";

import { useEffect, useMemo, useState } from "react";
import { excerpt } from "@/lib/worlds";
import type { WikiEntry } from "@/lib/worlds";
import type { Block, BlockVariant, VariantBox } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { SANDBOX, buildWorldData, safeJson } from "./world-data";
import styles from "../blocks.module.css";

type ItemData = {
  id: string;
  title: string;
  slug: string;
  url: string;
  content: string;
  imageUrl: string;
  category: string;
  excerpt: string;
  attributes: Record<string, string>;
};

/** Strip characters that could break out of a CSS url()/rule. */
function safeUrl(url: string): string {
  return url.replace(/["'()\\<>\s]/g, "");
}

/** Built-in box settings for a variant (lowest priority in the cascade). */
function boxRule(id: string, box: VariantBox | null | undefined): string {
  if (!box) return "";
  const decl: string[] = [];
  if (box.width) decl.push(`width:${box.width}`);
  if (box.height) decl.push(`height:${box.height}`);
  if (box.bgColor) decl.push(`background-color:${box.bgColor}`);
  if (box.bgImage) {
    decl.push(
      `background-image:url("${safeUrl(box.bgImage)}")`,
      "background-size:cover",
      "background-position:center",
    );
  }
  if (box.radius) decl.push(`border-radius:${box.radius}`);
  if (typeof box.opacity === "number") decl.push(`opacity:${box.opacity}`);
  if (decl.length === 0) return "";
  return `[data-variant="${id}"]{${decl.join(";")};}`;
}

/** Platform loop injected into the sandbox; authors only write one item template. */
const RUNTIME = `
(function(){
  var root = document.getElementById("items");
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];}); }
  function match(item,m){
    if(!m) return false;
    var f=m.field||"", raw = f.indexOf("attr.")===0 ? (item.attributes&&item.attributes[f.slice(5)]) : item[f];
    var v = raw==null?"":String(raw);
    if(m.op==="eq") return v===m.value;
    if(m.op==="neq") return v!==m.value;
    if(m.op==="contains") return v.indexOf(m.value)>=0;
    return false;
  }
  function pick(item){
    for(var i=0;i<VARIANTS.length;i++){ if(!VARIANTS[i].isDefault && match(item,VARIANTS[i].match)) return VARIANTS[i]; }
    for(var j=0;j<VARIANTS.length;j++){ if(VARIANTS[j].isDefault) return VARIANTS[j]; }
    return { id:"DEFAULT", props:{}, html:"", css:"" };
  }
  function tok(str,item,props,css){
    return String(str||"").replace(/{{\\s*([\\w.-]+)\\s*}}/g,function(_,k){
      var out="";
      if(k.indexOf("attr.")===0) out=(item.attributes&&item.attributes[k.slice(5)])||"";
      else if(k.indexOf("prop.")===0) out=props[k.slice(5)]||"";
      else if(k==="imageUrl") out=item.imageUrl||props.__defaultImage||"";
      else out=item[k]!=null?item[k]:"";
      return css?String(out):esc(out);
    });
  }
  for(var i=0;i<VARIANTS.length;i++){
    var v=VARIANTS[i];
    var s=document.createElement("style");
    s.textContent='@scope ([data-variant="'+v.id+'"]) {'+tok(v.css,{},v.props,true)+'}';
    document.head.appendChild(s);
  }
  var DH='<a class="ri-card" href="{{url}}" target="_blank"><div class="ri-thumb"><img src="{{imageUrl}}" alt=""/></div><strong>{{title}}</strong><p>{{excerpt}}</p></a>';
  var DC='.ri-card{display:block;padding:14px;border:1px solid #e0dacb;border-radius:10px;background:#fffef9;color:inherit;text-decoration:none;}.ri-thumb{aspect-ratio:16/10;background:#efe9dc;border-radius:6px;overflow:hidden;margin-bottom:8px;}.ri-thumb img{width:100%;height:100%;object-fit:cover;}.ri-card strong{display:block;}.ri-card p{margin:4px 0 0;font-size:.85rem;color:#6b6252;}';
  var ds=document.createElement("style");
  ds.textContent="@scope ([data-variant=DEFAULT]) {"+DC+"}";
  document.head.appendChild(ds);
  for(var k=0;k<ITEMS.length;k++){
    var item=ITEMS[k];
    var v=pick(item);
    var wrap=document.createElement("div");
    wrap.setAttribute("data-variant", v?v.id:"DEFAULT");
    var useDefault = !v || !v.html;
    wrap.innerHTML = tok(useDefault?DH:v.html, item, v?v.props:{}, false);
    root.appendChild(wrap);
  }
  function post(){ parent.postMessage({ type:"region-resize", id:BLOCK_ID, height:document.documentElement.scrollHeight }, "*"); }
  post();
  try { new ResizeObserver(post).observe(document.body); } catch(e){}
  document.addEventListener("click",function(e){
    var a=e.target && e.target.closest && e.target.closest("a[href]");
    if(!a) return;
    e.preventDefault();
    parent.postMessage({ type:"region-nav", id:BLOCK_ID, href:a.getAttribute("href") }, "*");
  },true);
})();
`;

export function VariantGrid({
  block,
  variants,
  entries,
}: {
  block: Block;
  variants: BlockVariant[];
  entries: WikiEntry[];
}) {
  const {
    world,
    entries: allEntries,
    byCategory,
    timeline,
    works,
    pageCss,
  } = useWorldBlocks();
  const [height, setHeight] = useState(260);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as {
        type?: string;
        id?: string;
        height?: number;
        href?: string;
      };
      if (!d || d.id !== block.id) return;
      if (d.type === "region-resize" && typeof d.height === "number") {
        setHeight(Math.max(120, Math.ceil(d.height)));
      } else if (d.type === "region-nav" && typeof d.href === "string") {
        if (d.href.startsWith("#")) {
          document
            .getElementById(d.href.slice(1))
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.open(d.href, "_blank", "noopener");
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [block.id]);

  const srcDoc = useMemo(() => {
    const items: ItemData[] = entries.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      url: `/w/${world.slug}/entry/${e.slug}`,
      content: e.content ?? "",
      imageUrl: e.imageUrl ?? "",
      category: e.category,
      excerpt: excerpt(e.content ?? "", 90),
      attributes: e.attributes ?? {},
    }));

    const fontCss: string[] = [];
    const boxCss: string[] = [];
    const payload = variants.map((v) => {
      const props: Record<string, string> = {};
      for (const f of v.fields) {
        const raw = v.values[f.key] ?? f.default ?? "";
        if (f.type === "font") {
          const family = `cf-${f.key}`;
          if (raw) {
            fontCss.push(
              `@font-face{font-family:'${family}';src:url('${raw}');font-display:swap;}`,
            );
            props[f.key] = family;
          } else {
            props[f.key] = "";
          }
        } else {
          props[f.key] = raw;
        }
      }
      props.__defaultImage = v.defaultImage ?? "";
      boxCss.push(boxRule(v.id, v.box));
      return {
        id: v.id,
        match: v.match ?? null,
        isDefault: v.isDefault === true,
        html: v.html,
        css: v.css,
        props,
      };
    });

    const data = buildWorldData({
      world,
      entries: allEntries,
      byCategory,
      timeline,
      works,
    });

    return [
      '<!doctype html><html><head><meta charset="utf-8" />',
      "<style>html,body{margin:0;padding:0;",
      "font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#14212b;}",
      "#items{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;}",
      fontCss.join(""),
      boxCss.join(""),
      "</style>",
      // Page-level CSS sits between the built-in box and the variant CSS.
      pageCss ? `<style>${pageCss}</style>` : "",
      "</head><body>",
      '<div id="items"></div>',
      `<script>window.WORLD=${safeJson(data)};window.ITEMS=${safeJson(items)};window.VARIANTS=${safeJson(payload)};window.BLOCK_ID=${safeJson(block.id)};${RUNTIME}</script>`,
      "</body></html>",
    ].join("");
  }, [
    block.id,
    variants,
    entries,
    world,
    allEntries,
    byCategory,
    timeline,
    works,
    pageCss,
  ]);

  return (
    <iframe
      title="区域卡片"
      className={styles.customFrame}
      sandbox={SANDBOX}
      style={{ height }}
      srcDoc={srcDoc}
    />
  );
}
