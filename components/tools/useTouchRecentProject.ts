"use client";

import { useEffect } from "react";
import {
  touchRecentProject,
  type ToolRecentKey,
} from "@/lib/tools/recent-projects";

export function useTouchRecentProject(
  tool: ToolRecentKey,
  projectId?: string | null
) {
  useEffect(() => {
    if (projectId) touchRecentProject(tool, projectId);
  }, [tool, projectId]);
}
