"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const NestedAnchorContext = createContext(false);

export function useNestedSectionAnchor() {
  return useContext(NestedAnchorContext);
}

export function DeferredPaint({
  id,
  eager = false,
  minHeight = 280,
  children,
}: {
  id?: string;
  eager?: boolean;
  minHeight?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(eager);

  useEffect(() => {
    if (eager) {
      setPainted(true);
      return;
    }
    if (painted) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setPainted(true);
      },
      { rootMargin: "800px 0px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, painted]);

  return (
    <NestedAnchorContext.Provider value={true}>
      <div ref={ref} id={id} data-ci-section-anchor={id || undefined}>
        {painted ? children : <div style={{ minHeight }} aria-hidden />}
      </div>
    </NestedAnchorContext.Provider>
  );
}
