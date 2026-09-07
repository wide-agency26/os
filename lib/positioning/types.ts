import type { ModuleKey } from "@/lib/strategy/modules";

export type PositioningStatus = "draft" | "finalized";

export type PositioningInputUsed = {
  finalizedAt: string;
  label: string;
};

export type PositioningInputsUsed = Partial<Record<ModuleKey, PositioningInputUsed>>;

export type StrategyPositioning = {
  id: string;
  strategyId: string;
  statement: string;
  rationale: string;
  inputsUsed: PositioningInputsUsed;
  status: PositioningStatus;
  aiGenerated: boolean;
  updatedAt: string;
};

export type PositioningSnapshot = {
  statement: string;
  rationale: string;
};

export type PositioningInputChip = {
  moduleKey: ModuleKey;
  label: string;
  attached: boolean;
  finalized: boolean;
  optional: boolean;
  note: string;
};

export type PositioningGate = {
  canGenerate: boolean;
  reason: string | null;
  chips: PositioningInputChip[];
};

export function firstSentence(text: string, max = 220): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const line = (match ? match[1] : trimmed).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function positioningModuleStatus(
  row: StrategyPositioning | null
): "not_started" | "in_progress" | "finalized" {
  if (!row) return "not_started";
  if (row.status === "finalized") return "finalized";
  return row.statement || row.rationale ? "in_progress" : "not_started";
}

export function positioningSnapshot(
  row: StrategyPositioning | null,
  clientSafe: boolean
): PositioningSnapshot | undefined {
  if (!row) return undefined;
  if (clientSafe && row.status !== "finalized") return undefined;
  if (!row.statement && !row.rationale) return undefined;
  return {
    statement: row.statement,
    rationale: row.rationale,
  };
}
