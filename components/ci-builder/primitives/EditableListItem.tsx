"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";

export interface EditableListItemProps {
  onDelete: () => void;
  deleteConfirmTitle?: string;
  isAdmin?: boolean;
  children: React.ReactNode;
  className?: string;
  reorderable?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function EditableListItem({
  onDelete,
  deleteConfirmTitle = "Delete this item? This can't be undone.",
  isAdmin = false,
  children,
  className = "",
  reorderable = false,
  onMoveUp,
  onMoveDown
}: EditableListItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isAdmin) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`group relative border border-transparent hover:border-gray-300/80 rounded-xl transition-all ${className}`}>
      {children}

      {/* Action Badges Bar (Top Right Corner) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-gray-200">
        {reorderable && (
          <>
            {onMoveUp && (
              <button
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
            {onMoveDown && (
              <button
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
          </>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Delete Confirmation Modal / Popover */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">Confirm Deletion</h4>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">{deleteConfirmTitle}</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onDelete();
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
