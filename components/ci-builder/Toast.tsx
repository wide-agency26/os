"use client";

import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";

export type ToastMessage = {
  id: string;
  text: string;
};

// Event-driven global toast trigger
type ToastListener = (msg: string) => void;
const listeners: Set<ToastListener> = new Set();

export function triggerToast(text: string) {
  listeners.forEach((fn) => fn(text));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleAdd = (text: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };

    listeners.add(handleAdd);
    return () => {
      listeners.delete(handleAdd);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-gray-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-xl shadow-xl border border-white/10 flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5" />
          </div>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
