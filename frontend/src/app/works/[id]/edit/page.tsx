"use client";

import { useParams } from "next/navigation";
import Workbench from "@/components/work/Workbench";

export default function WorkEditPage() {
  const params = useParams<{ id: string }>();
  return <Workbench initialCategory="other" workId={params.id} />;
}
