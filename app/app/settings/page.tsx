import { Workspace } from "@/components/frappe-ui/Workspace";
import Link from "next/link";

const LINKS = [
  {
    href: "/app/settings/connections",
    title: "Connections",
    body: "Google, Meta, Figma, Lexware, AI, and everything still missing — status and required key names.",
  },
  {
    href: "/app/settings/activity",
    title: "Activity",
    body: "Who opened the client portal in the last 14 days. Founder preview is tagged separately.",
  },
  {
    href: "/app/settings/observation",
    title: "Task log",
    body: "Task closures, reopens, and review-queue decisions for the last 14 days.",
  },
  {
    href: "/app/debug-center",
    title: "Debug center",
    body: "Bugs filed from any page, with URL, tab, trail, and console attached. Copy markdown for Cursor.",
  },
  {
    href: "/app/settings/integrations",
    title: "Inbound email",
    body: "Per-project aliases into the PM review queue.",
  },
  {
    href: "/app/settings/pm",
    title: "Cost / staleness",
    body: "Fragmentation penalty and stale-after days.",
  },
  {
    href: "/app/settings/roles-rates",
    title: "Roles & rates",
    body: "Placeholder for the rate card.",
  },
];

export default function SettingsIndexPage() {
  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Settings</h1>
      <p className="text-[13px] text-text-secondary mb-6 max-w-xl">
        Founder-only. API keys live in Vercel, not in these forms.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="border border-border rounded-lg bg-surface p-4 hover:border-text-muted/40 transition-colors"
          >
            <p className="text-[14px] font-semibold text-text-primary">{l.title}</p>
            <p className="text-[12px] text-text-secondary mt-1">{l.body}</p>
          </Link>
        ))}
      </div>
    </Workspace>
  );
}
