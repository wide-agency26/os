import Image from "next/image";

const LOGO_SRC = "/brand/wide-logo.png";

export type WideLogoVariant = "onDark" | "onLight";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * WIDE wordmark inside a compact branded box (sidebar / headers).
 */
export function WideLogo({
  variant = "onDark",
  className,
  height = 20,
  priority = false,
  boxed = true,
}: {
  variant?: WideLogoVariant;
  className?: string;
  height?: number;
  priority?: boolean;
  /** Wrap in bordered container — default on for nav */
  boxed?: boolean;
}) {
  const img = (
    <Image
      src={LOGO_SRC}
      alt="Wide"
      width={Math.round(height * 2.6)}
      height={height}
      priority={priority}
      className={cx(
        "object-contain object-left max-h-full w-auto",
        variant === "onDark" && !boxed && "mix-blend-lighten",
        variant === "onLight" && "brightness-0 invert"
      )}
      style={{ height, width: "auto", maxHeight: height }}
    />
  );

  if (!boxed) {
    return (
      <span className={cx("inline-flex shrink-0 items-center", className)}>{img}</span>
    );
  }

  return (
    <span
      className={cx(
        "inline-flex max-w-[200px] items-center rounded-lg border border-border/80 bg-black/50 px-3 py-2",
        variant === "onDark" && "mix-blend-lighten",
        className
      )}
    >
      {img}
    </span>
  );
}
