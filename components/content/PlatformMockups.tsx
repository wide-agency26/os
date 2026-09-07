"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { captionAt, type CaptionMap, type ContentMediaKind } from "@/lib/content/types";
import {
  feedSpecForPlatform,
  type ContentVisualFormat,
  VISUAL_FORMAT_SPECS,
} from "@/lib/content/formats";

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className = "w-3.5 h-3.5",
}: {
  platform: string;
  className?: string;
}) {
  if (platform === "instagram") return <InstagramGlyph className={className} />;
  return <LinkedInGlyph className={className} />;
}

function ProfileAvatar({
  brand,
  avatarUrl,
  className,
  textClassName = "text-[11px]",
}: {
  brand: string;
  avatarUrl?: string | null;
  className: string;
  textClassName?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`${className} object-cover bg-gray-100`} />
    );
  }
  return (
    <div
      className={`${className} bg-gray-900 text-white font-semibold flex items-center justify-center ${textClassName}`}
    >
      {brand.slice(0, 1).toUpperCase() || "W"}
    </div>
  );
}

function MediaPlaceholder({
  aspectRatio,
  formatLabel,
  label = "Visual placeholder",
}: {
  aspectRatio: string;
  formatLabel: string;
  label?: string;
}) {
  return (
    <div
      className="bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex flex-col items-center justify-center gap-0.5 w-full"
      style={{ aspectRatio }}
    >
      <span>{label}</span>
      <span className="text-[10px]">{formatLabel}</span>
    </div>
  );
}

function InstagramCarouselMedia({
  slides,
  aspectRatio,
  formatLabel,
}: {
  slides: string[];
  aspectRatio: string;
  formatLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const current = slides[index] || null;
  const multi = count > 1;

  if (!current) {
    return (
      <MediaPlaceholder
        aspectRatio={aspectRatio}
        formatLabel={formatLabel}
        label="Feed visual"
      />
    );
  }

  return (
    <div className="relative w-full bg-gray-100" style={{ aspectRatio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current} alt="" className="w-full h-full object-cover" />
      {multi ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-1 hover:bg-black/70"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setIndex((i) => (i + 1) % count)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-1 hover:bg-black/70"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute top-2 right-2 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5">
            {index + 1} / {count}
          </div>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-3 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function LinkedInMultiImageMedia({
  slides,
  aspectRatio,
  formatLabel,
}: {
  slides: string[];
  aspectRatio: string;
  formatLabel: string;
}) {
  if (!slides.length) {
    return <MediaPlaceholder aspectRatio={aspectRatio} formatLabel={formatLabel} />;
  }

  if (slides.length === 1) {
    return (
      <div className="w-full bg-gray-100" style={{ aspectRatio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slides[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  const thumbs = slides.slice(1, 4);
  const overflow = slides.length > 4 ? slides.length - 4 : 0;

  return (
    <div className="border-t border-gray-100">
      <div className="w-full bg-gray-100" style={{ aspectRatio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slides[0]} alt="" className="w-full h-full object-cover" />
      </div>
      {thumbs.length ? (
        <div className="grid grid-cols-3 gap-px bg-gray-200">
          {thumbs.map((url, i) => {
            const isLast = i === thumbs.length - 1 && overflow > 0;
            return (
              <div key={i} className="relative aspect-[4/3] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {isLast ? (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-lg font-semibold">
                    +{overflow}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function LinkedInMock({
  caption,
  brand,
  avatarUrl,
  slides = [],
  mediaKind,
  visualFormat = "feed",
  isVideo = false,
}: {
  caption: string;
  brand: string;
  avatarUrl?: string | null;
  slides?: string[];
  mediaKind?: ContentMediaKind;
  visualFormat?: ContentVisualFormat;
  isVideo?: boolean;
}) {
  const spec =
    visualFormat === "reel" || visualFormat === "story" || isVideo
      ? VISUAL_FORMAT_SPECS[visualFormat === "story" ? "story" : "reel"]
      : feedSpecForPlatform("linkedin", visualFormat, isVideo);
  const overflow = caption.length > 1400;
  const isCarousel = mediaKind === "carousel" || slides.length > 1;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden text-left">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <ProfileAvatar
          brand={brand}
          avatarUrl={avatarUrl}
          className="w-9 h-9 rounded-full shrink-0"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 truncate">{brand}</div>
          <div className="text-[11px] text-gray-500">Sponsored · LinkedIn</div>
        </div>
        <LinkedInGlyph className="w-4 h-4 text-[#0A66C2] ml-auto shrink-0" />
      </div>
      <div className="px-3 pb-3 text-[13px] leading-relaxed text-gray-800 whitespace-pre-wrap">
        {caption || <span className="text-gray-400 italic">No caption yet</span>}
        {overflow ? (
          <span className="block mt-1 text-[11px] text-amber-700">
            Long for LinkedIn desktop — consider trimming.
          </span>
        ) : null}
      </div>
      {isCarousel || slides.length > 1 ? (
        <LinkedInMultiImageMedia
          slides={slides}
          aspectRatio={spec.aspectCss}
          formatLabel={spec.shortLabel}
        />
      ) : slides[0] ? (
        <div className="w-full bg-gray-100" style={{ aspectRatio: spec.aspectCss }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slides[0]} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <MediaPlaceholder aspectRatio={spec.aspectCss} formatLabel={spec.shortLabel} />
      )}
    </div>
  );
}

export function InstagramMock({
  caption,
  brand,
  avatarUrl,
  slides = [],
  mediaKind,
  visualFormat = "feed",
  isVideo = false,
}: {
  caption: string;
  brand: string;
  avatarUrl?: string | null;
  slides?: string[];
  mediaKind?: ContentMediaKind;
  visualFormat?: ContentVisualFormat;
  isVideo?: boolean;
}) {
  const spec =
    visualFormat === "reel" || visualFormat === "story" || isVideo
      ? VISUAL_FORMAT_SPECS[visualFormat === "story" ? "story" : "reel"]
      : feedSpecForPlatform("instagram", visualFormat, isVideo);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden text-left max-w-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <ProfileAvatar
          brand={brand}
          avatarUrl={avatarUrl}
          className="w-7 h-7 rounded-full shrink-0"
          textClassName="text-[10px]"
        />
        <div className="text-[12px] font-semibold text-gray-900 truncate">{brand}</div>
        <InstagramGlyph className="w-3.5 h-3.5 ml-auto text-gray-700 shrink-0" />
      </div>
      <InstagramCarouselMedia
        slides={slides}
        aspectRatio={spec.aspectCss}
        formatLabel={spec.shortLabel}
      />
      <div className="px-3 py-2.5 text-[12px] leading-relaxed text-gray-800 whitespace-pre-wrap">
        <span className="font-semibold mr-1">{brand.replace(/\s+/g, "").toLowerCase()}</span>
        {caption || <span className="text-gray-400 italic">No caption yet</span>}
      </div>
    </div>
  );
}

export function CaptionPreview({
  captions,
  languages,
  brand,
  avatarUrl,
  mediaKind,
  instagramSlides = [],
  linkedinSlides = [],
  visualFormat = "feed",
  isVideo = false,
}: {
  captions: CaptionMap;
  languages: string[];
  brand: string;
  avatarUrl?: string | null;
  mediaKind?: ContentMediaKind;
  instagramSlides?: string[];
  linkedinSlides?: string[];
  visualFormat?: ContentVisualFormat;
  isVideo?: boolean;
}) {
  const langs = languages.length ? languages : ["en"];
  const igSlides = instagramSlides.filter(Boolean);
  const liSlides = linkedinSlides.filter(Boolean);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {langs.map((lang) => (
        <div key={lang} className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {lang}
            {mediaKind === "carousel" || igSlides.length > 1 || liSlides.length > 1 ? (
              <span className="ml-2 font-normal normal-case text-gray-400">
                · carousel IG {igSlides.length || 1} / LI {liSlides.length || 1}
              </span>
            ) : null}
          </div>
          <LinkedInMock
            caption={captionAt(captions, "linkedin", lang)}
            brand={brand}
            avatarUrl={avatarUrl}
            slides={liSlides}
            mediaKind={mediaKind}
            visualFormat={visualFormat}
            isVideo={isVideo}
          />
          <InstagramMock
            caption={captionAt(captions, "instagram", lang)}
            brand={brand}
            avatarUrl={avatarUrl}
            slides={igSlides}
            mediaKind={mediaKind}
            visualFormat={visualFormat}
            isVideo={isVideo}
          />
        </div>
      ))}
    </div>
  );
}
