"use client";

import type { ComponentType } from "react";
import type { Block, BlockType } from "@/lib/world-layout";
import { Columns } from "./chrome/Columns";
import { Footer } from "./chrome/Footer";
import { Hero } from "./chrome/Hero";
import { PlatformButton } from "./chrome/PlatformButton";
import { TopBar } from "./chrome/TopBar";
import { Prose } from "./content/Prose";
import { EntryGrid } from "./regions/EntryGrid";
import { Glossary } from "./regions/Glossary";
import { InfoBox } from "./regions/InfoBox";
import { Nav } from "./regions/Nav";
import { TimelineBlock } from "./regions/TimelineBlock";
import { WorkList } from "./regions/WorkList";

type BlockComponent = ComponentType<{ block: Block }>;

/**
 * Whitelist: block type → renderer. Types not present here are ignored.
 * New components must be registered here (and added to world-layout BLOCK_TYPES).
 */
export const registry: Partial<Record<BlockType, BlockComponent>> = {
  topBar: TopBar,
  hero: Hero,
  columns: Columns,
  footer: Footer,
  platformButton: PlatformButton,
  nav: Nav,
  prose: Prose,
  entryGrid: EntryGrid,
  glossary: Glossary,
  timeline: TimelineBlock,
  workList: WorkList,
  infoBox: InfoBox,
};
