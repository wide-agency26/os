"use client";

import React, { useEffect, useRef } from "react";
// @ts-ignore
import Gantt from "frappe-gantt";
import "./frappe-gantt.css";

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string; // comma separated ids
  custom_class?: string;
}

interface FrappeGanttProps {
  tasks: GanttTask[];
  viewMode?: "Quarter Day" | "Half Day" | "Day" | "Week" | "Month";
  onClick?: (task: GanttTask) => void;
  onDateChange?: (task: GanttTask, start: Date, end: Date) => void;
  onProgressChange?: (task: GanttTask, progress: number) => void;
  onViewChange?: (mode: string) => void;
}

export default function FrappeGantt({
  tasks,
  viewMode = "Day",
  onClick,
  onDateChange,
  onProgressChange,
  onViewChange
}: FrappeGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (tasks.length === 0) {
      // Clear the container if there are no tasks, else frappe-gantt crashes or renders weirdly
      containerRef.current.innerHTML = "";
      return;
    }

    if (!ganttRef.current) {
      ganttRef.current = new Gantt(containerRef.current, tasks, {
        header_height: 50,
        column_width: 30,
        step: 24,
        view_modes: ["Quarter Day", "Half Day", "Day", "Week", "Month"],
        bar_height: 20,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        view_mode: viewMode,
        date_format: "YYYY-MM-DD",
        custom_popup_html: null, // Let frappe-gantt handle default popup or customize if needed
        on_click: (task: any) => {
          if (onClick) onClick(task);
        },
        on_date_change: (task: any, start: Date, end: Date) => {
          if (onDateChange) onDateChange(task, start, end);
        },
        on_progress_change: (task: any, progress: number) => {
          if (onProgressChange) onProgressChange(task, progress);
        },
        on_view_change: (mode: string) => {
          if (onViewChange) onViewChange(mode);
        }
      });
    } else {
      ganttRef.current.refresh(tasks);
    }
  }, [tasks, viewMode, onClick, onDateChange, onProgressChange, onViewChange]);

  useEffect(() => {
    if (ganttRef.current && viewMode) {
      ganttRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  return (
    <div className="frappe-gantt-wrapper bg-white border border-gray-200 rounded-lg overflow-x-auto p-4">
      {tasks.length > 0 ? (
        <div ref={containerRef} />
      ) : (
        <div className="py-12 text-center text-gray-500 text-sm">
          No tasks with timeline dates to display in Gantt chart.
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .frappe-gantt-wrapper .gantt {
          font-family: inherit;
        }
        .frappe-gantt-wrapper .gantt .bar-progress {
          fill: #3b82f6;
        }
        .frappe-gantt-wrapper .gantt .bar-wrapper.active .bar-progress {
          fill: #2563eb;
        }
      `}} />
    </div>
  );
}
