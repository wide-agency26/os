"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  finalizeSocialAssetUpload,
  prepareSocialAssetUpload,
  removeSocialCover,
  saveLinkedInEmployeeCopy,
  setPreferredSocialCover,
} from "@/app/actions/content-calendar";
import type { ContentSocialAssets, SocialCoverKind, SocialCoverOption } from "@/lib/content/types";
import { parseSocialAssets } from "@/lib/content/social-assets";

function CoverGrid({
  title,
  hint,
  kind,
  covers,
  projectId,
  pending,
  onAssets,
  run,
}: {
  title: string;
  hint: string;
  kind: SocialCoverKind;
  covers: SocialCoverOption[];
  projectId: string;
  pending: boolean;
  onAssets: (a: ContentSocialAssets) => void;
  run: (fn: () => Promise<{ ok: boolean; error?: string; social_assets?: ContentSocialAssets }>, okMsg: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{title}</p>
        <p className="text-[12px] text-gray-600 mt-0.5">{hint}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {covers.map((c) => (
          <div
            key={c.id}
            className={`rounded-md border p-2 space-y-2 ${
              c.preferred ? "border-gray-900" : "border-gray-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.url}
              alt={c.label}
              className="w-full h-20 object-cover rounded border border-gray-100"
            />
            <p className="text-[12px] font-medium text-gray-800 truncate">{c.label}</p>
            <div className="flex flex-wrap gap-1">
              {!c.preferred ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await setPreferredSocialCover(projectId, c.id, kind);
                      if (res.ok && res.social_assets) onAssets(parseSocialAssets(res.social_assets));
                      return res;
                    }, "Preferred set")
                  }
                  className="rounded border border-gray-200 px-2 py-1 text-[11px]"
                >
                  Prefer
                </button>
              ) : (
                <span className="rounded bg-gray-900 text-white px-2 py-1 text-[11px]">Preferred</span>
              )}
              <a
                href={c.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-gray-200 px-2 py-1 text-[11px]"
              >
                Download
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await removeSocialCover(projectId, c.id, kind);
                    if (res.ok && res.social_assets) onAssets(parseSocialAssets(res.social_assets));
                    return res;
                  }, "Cover removed")
                }
                className="rounded border border-gray-200 px-2 py-1 text-[11px] text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="inline-flex rounded-md border border-gray-200 px-3 py-1.5 text-[13px] cursor-pointer hover:bg-gray-50">
        Upload {kind === "company" ? "company" : "employee"} cover
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            run(async () => {
              const prepared = await prepareSocialAssetUpload(
                projectId,
                file.name,
                file.type,
                file.size
              );
              if (!prepared.ok) return prepared;
              const supabase = createClient();
              const { error: upErr } = await supabase.storage
                .from("content-media")
                .uploadToSignedUrl(prepared.path, prepared.token, file, {
                  contentType: prepared.mimeType,
                  upsert: true,
                });
              if (upErr) return { ok: false as const, error: upErr.message };
              const fin = await finalizeSocialAssetUpload(projectId, {
                path: prepared.path,
                kind,
                label: file.name.replace(/\.[^.]+$/, ""),
              });
              if (fin.ok && fin.social_assets) onAssets(parseSocialAssets(fin.social_assets));
              return fin;
            }, "Cover uploaded");
          }}
        />
      </label>
    </div>
  );
}

export function SocialKitAdminPanel({
  projectId,
  initial,
  onMsg,
}: {
  projectId: string;
  initial: ContentSocialAssets;
  onMsg?: (msg: string | null) => void;
}) {
  const [assets, setAssets] = useState(() => parseSocialAssets(initial));
  const [pending, start] = useTransition();
  const [aboutDe, setAboutDe] = useState(assets.linkedin_employee_copy.about_de);
  const [aboutEn, setAboutEn] = useState(assets.linkedin_employee_copy.about_en);
  const [bulletsDe, setBulletsDe] = useState(
    assets.linkedin_employee_copy.experience_bullets_de.join("\n")
  );
  const [bulletsEn, setBulletsEn] = useState(
    assets.linkedin_employee_copy.experience_bullets_en.join("\n")
  );
  const [companyUrl, setCompanyUrl] = useState(assets.linkedin_employee_copy.company_url);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; social_assets?: ContentSocialAssets }>,
    okMsg: string
  ) {
    start(async () => {
      onMsg?.(null);
      const res = await fn();
      if (!res.ok) onMsg?.(res.error || "Failed");
      else onMsg?.(okMsg);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">LinkedIn kit</p>
        <p className="text-[12px] text-gray-600 mt-0.5">
          Company + employee cover options and About/Experience copy for the client portal.
        </p>
      </div>

      <CoverGrid
        title="Company LinkedIn covers"
        hint="Upload ~4200×700 (6:1). Preferred is what staff highlight first."
        kind="company"
        covers={assets.company_covers}
        projectId={projectId}
        pending={pending}
        onAssets={setAssets}
        run={run}
      />

      <CoverGrid
        title="Employee LinkedIn covers"
        hint="Upload 1584×396 (4:1). Clients pick one for personal profiles."
        kind="employee"
        covers={assets.employee_covers}
        projectId={projectId}
        pending={pending}
        onAssets={setAssets}
        run={run}
      />

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">
          Employee LinkedIn copy
        </p>
        <label className="block">
          <span className="text-[11px] text-gray-500">Company page URL</span>
          <input
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-gray-500">About (DE)</span>
            <textarea
              value={aboutDe}
              onChange={(e) => setAboutDe(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">About (EN)</span>
            <textarea
              value={aboutEn}
              onChange={(e) => setAboutEn(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">Experience bullets DE (one per line)</span>
            <textarea
              value={bulletsDe}
              onChange={(e) => setBulletsDe(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">Experience bullets EN (one per line)</span>
            <textarea
              value={bulletsEn}
              onChange={(e) => setBulletsEn(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await saveLinkedInEmployeeCopy(projectId, {
                about_de: aboutDe,
                about_en: aboutEn,
                experience_bullets_de: bulletsDe
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                experience_bullets_en: bulletsEn
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                company_url: companyUrl,
              });
              if (res.ok && res.social_assets) setAssets(parseSocialAssets(res.social_assets));
              return res;
            }, "LinkedIn copy saved")
          }
          className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px]"
        >
          Save LinkedIn copy
        </button>
      </div>
    </div>
  );
}
