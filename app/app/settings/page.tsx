import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import Link from "next/link";

export default function SettingsIndexPage() {
  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
      <Section title="PM">
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/app/settings/roles-rates" className="underline text-gray-800">
              Roles & Rates
            </Link>
            <span className="text-gray-400 ml-2">stub</span>
          </li>
          <li>
            <Link href="/app/settings/integrations" className="underline text-gray-800">
              Integrations
            </Link>
            <span className="text-gray-400 ml-2">email → task</span>
          </li>
          <li>
            <Link href="/app/settings/pm" className="underline text-gray-800">
              Cost / staleness settings
            </Link>
          </li>
        </ul>
      </Section>
    </Workspace>
  );
}
