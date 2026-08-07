"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

export type TaskContentEditorProps = {
  taskId: string;
  /** BlockNote document, or undefined to start empty / seeded by parent. */
  initialContent: PartialBlock[] | undefined;
  /** Debounced persist — parent writes content_blocks (+ optional plain summary). */
  onSave: (blocks: Block[]) => void;
  /** Debounce window for onChange → onSave (ms). */
  debounceMs?: number;
  editable?: boolean;
  className?: string;
};

/**
 * Notion-style BlockNote editor for a single PM task's body.
 * Uncontrolled: never pass blocks as a controlled `value` after mount.
 * CSS is loaded once via app/globals.css — do not re-import theme sheets here.
 */
export function TaskContentEditor({
  taskId,
  initialContent,
  onSave,
  debounceMs = 800,
  editable = true,
  className = "",
}: TaskContentEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useCreateBlockNote(
    {
      initialContent:
        initialContent && initialContent.length > 0
          ? initialContent
          : undefined,
    },
    [taskId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleChange = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSaveRef.current(editor.document as Block[]);
    }, debounceMs);
  };

  const wrapperClass = useMemo(
    () =>
      [
        "bn-task-editor bn-root overflow-visible bg-white",
        "[&_.bn-editor]:min-h-[12rem] [&_.bn-editor]:px-2 [&_.bn-editor]:py-1",
        "[&_.bn-editor]:text-sm [&_.bn-editor]:text-gray-900",
        "[&_.bn-editor]:!bg-transparent",
        className,
      ].join(" "),
    [className]
  );

  return (
    <div className={wrapperClass} data-task-id={taskId} data-color-scheme="light">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        onChange={handleChange}
      />
      <p className="px-2 pt-2 text-[10px] text-gray-400">
        Type <kbd className="px-1 rounded bg-gray-100 text-gray-600">/</kbd> for
        blocks · tables supported
      </p>
    </div>
  );
}
