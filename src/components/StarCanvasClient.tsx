"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { VOID_COLOR } from "@/lib/theme";

const StarCanvas = dynamic(() => import("@/components/StarCanvas"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full" style={{ backgroundColor: VOID_COLOR }} />
  ),
});

export default function StarCanvasClient(
  props: ComponentProps<typeof StarCanvas>,
) {
  return <StarCanvas {...props} />;
}
