"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, ArrowUp, ArrowDown, X } from "lucide-react";

export interface EditableListItemProps {
  onDelete: () => void;
  deleteConfirmTitle?: string;
  isAdmin?: boolean;
  children: React.ReactNode;
  className?: string;
  /** card = floating toolbar (blocks). chip = pill tags. row = inline list lines. */
  variant?: "card" | "chip" | "row";
  reorderable?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function DeleteConfirm({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ci-chrome bg-white text-gray-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-red-600">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 text-sm">Confirm Deletion</h4>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{title}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 shadow-sm"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditableListItem({
  onDelete,
  deleteConfirmTitle = "Delete this item? This can't be undone.",
  isAdmin = false,
  children,
  className = "",
  variant = "card",
  reorderable = false,
  onMoveUp,
  onMoveDown,
}: EditableListItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const confirm = showConfirm ? (
    <DeleteConfirm
      title={deleteConfirmTitle}
      onCancel={() => setShowConfirm(false)}
      onConfirm={() => {
        setShowConfirm(false);
        onDelete();
      }}
    />
  ) : null;

  if (!isAdmin) {
    return variant === "chip" ? (
      <div className={`inline-flex ${className}`}>{children}</div>
    ) : (
      <div className={className}>{children}</div>
    );
  }

  const deleteBtn = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowConfirm(true);
      }}
      className={
        variant === "chip"
          ? "ml-1 p-0.5 rounded-full text-[var(--ci-accent)]/50 hover:text-red-600 hover:bg-white/80 transition-colors"
          : "p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
      }
      title="Delete item"
    >
      {variant === "chip" ? <X className="w-3 h-3" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );

  if (variant === "chip") {
    return (
      <div className={`group/chip relative inline-flex items-center ${className}`}>
        {children}
        <span className="inline-flex opacity-0 group-hover/chip:opacity-100 transition-opacity">
          {deleteBtn}
        </span>
        {confirm}
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className={`group/row relative flex items-start gap-1 ${className}`}>
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity pt-0.5">
          {reorderable && onMoveUp && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="Move up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          {reorderable && onMoveDown && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="Move down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
          {deleteBtn}
        </div>
        {confirm}
      </div>
    );
  }

  return (
    <div
      className={`group relative border border-transparent hover:border-gray-300/80 rounded-xl transition-all ${className}`}
    >
      {children}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-gray-200">
        {reorderable && onMoveUp && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"
            title="Move Up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {reorderable && onMoveDown && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"
            title="Move Down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        {deleteBtn}
      </div>
      {confirm}
    </div>
  );
}
