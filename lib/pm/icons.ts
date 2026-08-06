import {
  Lock,
  Check,
  RefreshCw,
  Clock,
  Coins,
  Mail,
  Inbox,
  type LucideIcon,
} from "lucide-react";

/** Canonical PM iconography — one icon per concept, reused everywhere. */
export const PM_ICONS = {
  gate: Lock,
  gateCleared: Check,
  recurring: RefreshCw,
  stale: Clock,
  costCenter: Coins,
  fromEmail: Mail,
  pendingReview: Inbox,
} as const satisfies Record<string, LucideIcon>;

export type PmIconKey = keyof typeof PM_ICONS;
