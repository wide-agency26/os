"use client";

import Image from "next/image";
import type { CSSProperties, ReactEventHandler } from "react";

function canOptimize(src: string) {
  try {
    const host = new URL(src).hostname;
    return host.endsWith("supabase.co") || host.endsWith("supabase.in");
  } catch {
    return false;
  }
}

export function CiMediaImage({
  src,
  alt,
  className,
  priority = false,
  width = 960,
  height = 640,
  sizes = "(max-width: 960px) 100vw, 960px",
  style,
  onError,
  /** Fill a sized parent. Prefer non-fill for logo stages. */
  fill = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  style?: CSSProperties;
  onError?: ReactEventHandler<HTMLImageElement>;
  fill?: boolean;
}) {
  if (!src) return null;

  const containStyle: CSSProperties = {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    ...style,
  };

  if (canOptimize(src)) {
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={className}
          style={containStyle}
          unoptimized={/\.svg(\?|$)/i.test(src)}
          onError={onError}
        />
      );
    }
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={className}
        style={containStyle}
        unoptimized={/\.svg(\?|$)/i.test(src)}
        onError={onError}
      />
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ...containStyle,
        }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={onError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={containStyle}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={onError}
    />
  );
}
