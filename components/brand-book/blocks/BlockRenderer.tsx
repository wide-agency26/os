import React, { useState } from "react";
import Image from "next/image";

function OverviewBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <p className="text-sm font-semibold tracking-widest text-[#00FF00] uppercase">Overview</p>
        <h1 className="text-6xl font-black tracking-tighter text-white lg:text-8xl">
          {payload.brand_name}
        </h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <p className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Mission</p>
          <p className="text-xl leading-relaxed text-zinc-200">{payload.mission}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <p className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Vision</p>
          <p className="text-xl leading-relaxed text-zinc-200">{payload.vision}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-[#00FF00]/20 bg-zinc-900/50 p-8 lg:p-12">
        <p className="mb-6 text-xs font-semibold tracking-widest text-[#00FF00] uppercase">Brand Manifesto</p>
        <div className="prose prose-invert prose-lg max-w-none text-zinc-300">
          <p className="whitespace-pre-wrap">{payload.manifesto}</p>
        </div>
      </div>
    </div>
  );
}

function LogoBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white tracking-tight">Logo Set</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex justify-center items-center">
          <img src={payload.primary_dark} alt="Primary Dark" className="max-w-full h-auto object-contain" />
        </div>
        <div className="rounded-2xl border border-zinc-300 bg-white p-8 flex justify-center items-center">
          <img src={payload.primary_light} alt="Primary Light" className="max-w-full h-auto object-contain" />
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">Clearspace Rules: <span className="text-white font-mono">{payload.clearspace_rules}</span></p>
      </div>
    </div>
  );
}

function FarbenBlock({ payload }: { payload: any }) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedHex(text);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Farben</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {payload.colors?.map((color: any, idx: number) => (
          <button
            key={idx}
            onClick={() => copyToClipboard(color.hex)}
            className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl border border-zinc-800 transition-all hover:scale-105 hover:border-[#00FF00] hover:shadow-[0_0_20px_rgba(0,255,0,0.2)] text-left"
          >
            <div className="absolute inset-0" style={{ backgroundColor: color.hex }} />
            <div className="relative z-10 w-full bg-zinc-950/80 p-3 backdrop-blur-md transition-colors group-hover:bg-zinc-950/90">
              <p className="truncate text-xs font-medium text-zinc-300">{color.label}</p>
              <p className="mt-1 font-mono text-sm text-[#00FF00]">
                {copiedHex === color.hex ? "COPIED!" : color.hex}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TypografieBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Typografie</h2>
      <div className="grid gap-6">
        {payload.fonts?.map((typo: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-4">
              <p className="text-xs font-semibold tracking-widest text-[#00FF00] uppercase">{typo.label}</p>
              <div className="flex gap-4 text-xs font-mono text-zinc-500">
                <span>{typo.fontFamily}</span>
                <span>W: {typo.fontWeight}</span>
                <span>S: {typo.size}</span>
                <span>T: {typo.tracking}</span>
              </div>
            </div>
            <p
              className="mt-6 truncate text-zinc-200"
              style={{
                fontFamily: typo.fontFamily,
                fontWeight: typo.fontWeight,
                fontSize: "2rem",
                letterSpacing: typo.tracking !== "normal" ? typo.tracking : "normal",
              }}
            >
              Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ButtonsBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Buttons</h2>
      <div className="flex flex-wrap gap-6 p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50">
        {payload.styles?.map((btn: any, idx: number) => (
          <div key={idx} className="flex flex-col gap-3">
            <button className={`px-6 py-3 font-semibold transition-transform hover:scale-105 active:scale-95 ${btn.css}`}>
              {btn.label}
            </button>
            <span className="text-xs text-zinc-600 font-mono text-center">{btn.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RasterFramesBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Raster & Frames</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {payload.frames?.map((frame: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-4">
            <p className="text-sm font-semibold text-zinc-300">{frame.label}</p>
            <img src={frame.url} alt={frame.label} className="w-full h-auto rounded-lg border border-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HintergrundeBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Hintergründe</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {payload.backgrounds?.map((bg: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 overflow-hidden">
            <img src={bg.url} alt={`Background ${idx}`} className="w-full h-auto object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BildspracheBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Bildsprache</h2>
      <ul className="space-y-4">
        {payload.rules?.map((rule: string, idx: number) => (
          <li key={idx} className="flex items-center gap-4 text-zinc-300 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
            <div className="h-2 w-2 rounded-full bg-[#00FF00]"></div>
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpracheTonalitatBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white tracking-tight">Sprache & Tonalität</h2>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#00FF00]">Slogans</h3>
        {payload.slogans?.map((slogan: string, idx: number) => (
          <div key={idx} className="text-3xl font-black uppercase text-zinc-100">{slogan}</div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
          <h4 className="text-sm font-semibold text-zinc-400 mb-4 uppercase">Do</h4>
          <ul className="space-y-2 text-zinc-300">
            {payload.do_list?.map((item: string, idx: number) => <li key={idx}>✓ {item}</li>)}
          </ul>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
          <h4 className="text-sm font-semibold text-zinc-400 mb-4 uppercase">Don't</h4>
          <ul className="space-y-2 text-zinc-300">
            {payload.dont_list?.map((item: string, idx: number) => <li key={idx}>✕ {item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AnwendungenBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Anwendungen</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {payload.mockups?.map((mockup: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-4">
            <p className="text-sm font-semibold text-zinc-300">{mockup.label}</p>
            <img src={mockup.url} alt={mockup.label} className="w-full h-auto rounded-lg border border-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DosDontsBlock({ payload }: { payload: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Do's & Don'ts</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {payload.examples?.map((ex: any, idx: number) => (
          <div key={idx} className={`rounded-2xl border p-2 ${ex.status === 'DO' ? 'border-[#00FF00]/30 bg-[#00FF00]/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <img src={ex.image} alt={ex.label} className="w-full h-auto rounded-xl" />
            <div className="p-4">
              <p className="text-sm font-medium text-zinc-200">{ex.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlockRenderer({ block }: { block: any }) {
  if (!block || !block.is_visible) return null;

  switch (block.type) {
    case "overview": return <OverviewBlock payload={block.payload} />;
    case "logo": return <LogoBlock payload={block.payload} />;
    case "farben": return <FarbenBlock payload={block.payload} />;
    case "typografie": return <TypografieBlock payload={block.payload} />;
    case "buttons": return <ButtonsBlock payload={block.payload} />;
    case "raster_frames": return <RasterFramesBlock payload={block.payload} />;
    case "hintergrunde": return <HintergrundeBlock payload={block.payload} />;
    case "bildsprache": return <BildspracheBlock payload={block.payload} />;
    case "sprache_tonalitat": return <SpracheTonalitatBlock payload={block.payload} />;
    case "anwendungen": return <AnwendungenBlock payload={block.payload} />;
    case "dos_donts": return <DosDontsBlock payload={block.payload} />;
    default:
      return (
        <div className="p-4 border border-zinc-800 rounded bg-zinc-900/50 text-zinc-500 text-sm">
          Unknown block type: {block.type}
        </div>
      );
  }
}
