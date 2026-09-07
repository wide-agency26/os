"use client";

import { useMemo, useState, useTransition } from "react";
import {
  resetStrategyDefaults,
  saveStrategyTypeModules,
  saveStrategyTypeServices,
  updatePackageCopy,
  updateServiceCopy,
} from "@/app/actions/strategy";
import {
  MODULE_KEYS,
  MODULE_LABELS,
  STRATEGY_TYPES,
  STRATEGY_TYPE_LABELS,
  type ModuleKey,
  type StrategyType,
} from "@/lib/strategy/modules";
import type { CatalogPackageRow, CatalogServiceRow } from "@/lib/strategy/types";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { Button, PageHeader, Panel } from "@/components/frappe-ui/primitives";

export function PlaybooksStrategyAdmin({
  services,
  packages,
  typeServices,
  typeModules,
}: {
  services: CatalogServiceRow[];
  packages: CatalogPackageRow[];
  typeServices: Record<string, string[]>;
  typeModules: Record<string, ModuleKey[]>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [svcDraft, setSvcDraft] = useState<Record<string, { short: string; full: string }>>(
    () =>
      Object.fromEntries(
        services.map((s) => [s.id, { short: s.shortDescription, full: s.fullDescription }])
      )
  );
  const [pkgDraft, setPkgDraft] = useState<
    Record<
      string,
      {
        description: string;
        longTitle: string;
        timelineLongTitle: string;
        timelineShortTitle: string;
        timelineDuration: string;
        timelineDescription: string;
      }
    >
  >(() =>
    Object.fromEntries(
      packages.map((p) => [
        p.id,
        {
          description: p.description,
          longTitle: p.longTitle,
          timelineLongTitle: p.timelineLongTitle,
          timelineShortTitle: p.timelineShortTitle,
          timelineDuration: p.timelineDuration,
          timelineDescription: p.timelineDescription,
        },
      ])
    )
  );
  const [maps, setMaps] = useState(typeServices);
  const [mods, setMods] = useState(typeModules);
  const [openType, setOpenType] = useState<StrategyType | null>(STRATEGY_TYPES[0]);

  const serviceName = useMemo(() => {
    const m = new Map(services.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? id;
  }, [services]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <Workspace>
      <PageHeader
        title="Strategy catalog"
        subtitle="Pitch copy and which playbook services each strategy type composes. Playbook tasks stay untouched."
        actions={
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await resetStrategyDefaults();
                flash(res.ok ? "Defaults restored" : res.error || "Failed");
                if (res.ok) window.location.reload();
              })
            }
          >
            Reset strategy defaults
          </Button>
        }
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <Section title="Packages">
        <div className="space-y-3">
          {packages.map((p) => {
            const d = pkgDraft[p.id];
            if (!d) return null;
            return (
              <Panel key={p.id} className="p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-text-primary">{p.name}</h3>
                  <span className="text-[11px] text-text-muted">{p.slug}</span>
                </div>
                <label className="block text-[12px] text-text-secondary">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                    rows={2}
                    value={d.description}
                    onChange={(e) =>
                      setPkgDraft((prev) => ({
                        ...prev,
                        [p.id]: { ...d, description: e.target.value },
                      }))
                    }
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(
                    [
                      ["longTitle", "Long title"],
                      ["timelineLongTitle", "Timeline long title"],
                      ["timelineShortTitle", "Timeline short title"],
                      ["timelineDuration", "Timeline duration"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-[12px] text-text-secondary">
                      {label}
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                        value={d[key]}
                        onChange={(e) =>
                          setPkgDraft((prev) => ({
                            ...prev,
                            [p.id]: { ...d, [key]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-[12px] text-text-secondary">
                  Timeline description
                  <textarea
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                    rows={2}
                    value={d.timelineDescription}
                    onChange={(e) =>
                      setPkgDraft((prev) => ({
                        ...prev,
                        [p.id]: { ...d, timelineDescription: e.target.value },
                      }))
                    }
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await updatePackageCopy({ id: p.id, ...d });
                      flash(res.ok ? `Saved ${p.name}` : res.error || "Failed");
                    })
                  }
                >
                  Save package copy
                </Button>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title="Services">
        <div className="space-y-3">
          {services.map((s) => {
            const d = svcDraft[s.id];
            if (!d) return null;
            return (
              <Panel key={s.id} className="p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-text-primary">{s.name}</h3>
                  <span className="text-[11px] text-text-muted">
                    {s.category} · {s.slug}
                  </span>
                </div>
                <label className="block text-[12px] text-text-secondary">
                  Short description
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                    value={d.short}
                    onChange={(e) =>
                      setSvcDraft((prev) => ({
                        ...prev,
                        [s.id]: { ...d, short: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="block text-[12px] text-text-secondary">
                  Full description
                  <textarea
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                    rows={3}
                    value={d.full}
                    onChange={(e) =>
                      setSvcDraft((prev) => ({
                        ...prev,
                        [s.id]: { ...d, full: e.target.value },
                      }))
                    }
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await updateServiceCopy({
                        id: s.id,
                        shortDescription: d.short,
                        fullDescription: d.full,
                      });
                      flash(res.ok ? `Saved ${s.name}` : res.error || "Failed");
                    })
                  }
                >
                  Save service copy
                </Button>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title="Strategy type maps">
        <div className="space-y-2">
          {STRATEGY_TYPES.map((type) => {
            const open = openType === type;
            const mapped = maps[type] ?? [];
            const defaultMods = mods[type] ?? [];
            return (
              <Panel key={type}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => setOpenType(open ? null : type)}
                >
                  <span className="text-[13px] font-semibold text-text-primary">
                    {STRATEGY_TYPE_LABELS[type]}
                  </span>
                  <span className="text-[12px] text-text-muted">
                    {mapped.length} services · {defaultMods.length} modules
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Composed services
                      </p>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {services.map((s) => {
                          const checked = mapped.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 text-[13px] text-text-primary"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setMaps((prev) => {
                                    const cur = prev[type] ?? [];
                                    return {
                                      ...prev,
                                      [type]: checked
                                        ? cur.filter((id) => id !== s.id)
                                        : [...cur, s.id],
                                    };
                                  });
                                }}
                              />
                              {s.name}
                            </label>
                          );
                        })}
                      </div>
                      <Button
                        className="mt-3"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await saveStrategyTypeServices({
                              strategyType: type,
                              serviceIds: maps[type] ?? [],
                            });
                            flash(
                              res.ok
                                ? `Saved ${STRATEGY_TYPE_LABELS[type]} services`
                                : res.error || "Failed"
                            );
                          })
                        }
                      >
                        Save services
                      </Button>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Default modules
                      </p>
                      <div className="space-y-1.5">
                        {MODULE_KEYS.map((key) => {
                          const checked = defaultMods.includes(key);
                          return (
                            <label
                              key={key}
                              className="flex items-center gap-2 text-[13px] text-text-primary"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setMods((prev) => {
                                    const cur = prev[type] ?? [];
                                    return {
                                      ...prev,
                                      [type]: checked
                                        ? cur.filter((k) => k !== key)
                                        : [...cur, key],
                                    };
                                  });
                                }}
                              />
                              {MODULE_LABELS[key]}
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[12px] text-text-muted mt-2">
                        Order follows the list above. Currently:{" "}
                        {defaultMods.map((k) => MODULE_LABELS[k]).join(" → ") || "none"}
                      </p>
                      <Button
                        className="mt-3"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await saveStrategyTypeModules({
                              strategyType: type,
                              moduleKeys: mods[type] ?? [],
                            });
                            flash(
                              res.ok
                                ? `Saved ${STRATEGY_TYPE_LABELS[type]} modules`
                                : res.error || "Failed"
                            );
                          })
                        }
                      >
                        Save modules
                      </Button>
                    </div>
                    {mapped.length ? (
                      <p className="text-[12px] text-text-muted">
                        Maps to {mapped.map(serviceName).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </Section>
    </Workspace>
  );
}
