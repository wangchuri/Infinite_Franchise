"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HomepageConfig } from "@/lib/homepage-config";
import {
  collectSections,
  type LayoutSection,
  type WorldLayout,
} from "@/lib/world-layout";
import type { TimelineEvent, WikiEntry, World } from "@/lib/worlds";
import type { Work } from "@/lib/works";

export type WorldBlocksData = {
  world: World;
  entries: WikiEntry[];
  byCategory: Record<string, WikiEntry[]>;
  timeline: TimelineEvent[];
  works: Work[];
  isOwner: boolean;
  config: HomepageConfig;
  layout: WorldLayout;
  sections: LayoutSection[];
  activeId: string;
};

const WorldBlocksContext = createContext<WorldBlocksData | null>(null);

export function useWorldBlocks(): WorldBlocksData {
  const ctx = useContext(WorldBlocksContext);
  if (!ctx) {
    throw new Error("useWorldBlocks must be used inside <WorldBlocksProvider>");
  }
  return ctx;
}

export default function WorldBlocksProvider({
  world,
  entries,
  timeline,
  works,
  isOwner,
  config,
  layout,
  children,
}: {
  world: World;
  entries: WikiEntry[];
  timeline: TimelineEvent[];
  works: Work[];
  isOwner: boolean;
  config: HomepageConfig;
  layout: WorldLayout;
  children: ReactNode;
}) {
  const byCategory = useMemo(() => {
    const pick = (c: string) => entries.filter((e) => e.category === c);
    return {
      character: pick("character"),
      location: pick("location"),
      organization: pick("organization"),
      concept: pick("concept"),
      item: pick("item"),
      event: pick("event"),
    } satisfies Record<string, WikiEntry[]>;
  }, [entries]);

  const sections = useMemo(() => collectSections(layout.blocks), [layout.blocks]);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const value: WorldBlocksData = {
    world,
    entries,
    byCategory,
    timeline,
    works,
    isOwner,
    config,
    layout,
    sections,
    activeId,
  };

  return (
    <WorldBlocksContext.Provider value={value}>
      {children}
    </WorldBlocksContext.Provider>
  );
}
