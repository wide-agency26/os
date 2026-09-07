import type {
  ModuleKey,
  ModuleStatus,
  ScopeStatus,
  StrategyStatus,
  StrategyType,
} from "@/lib/strategy/modules";

export type CatalogServiceRow = {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  shortDescription: string;
  fullDescription: string;
  sortOrder: number;
};

export type CatalogPackageRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  longTitle: string;
  timelineLongTitle: string;
  timelineShortTitle: string;
  timelineDuration: string;
  timelineDescription: string;
  processSteps: string[];
  serviceIds: string[];
  sortOrder: number;
};

export type ScopeItemRow = {
  id: string;
  serviceId: string | null;
  customName: string | null;
  customDescription: string | null;
  sortOrder: number;
  serviceName?: string | null;
};

export type ScopeStepRow = {
  id: string;
  sortOrder: number;
  title: string;
};

export type ScopeRow = {
  id: string;
  projectId: string;
  basedOnPackageId: string | null;
  packageName?: string | null;
  status: ScopeStatus;
  createdAt: string;
  updatedAt: string;
  items: ScopeItemRow[];
  steps: ScopeStepRow[];
};

export type StrategyModuleRow = {
  id: string;
  moduleKey: ModuleKey;
  status: ModuleStatus;
  sortOrder: number;
};

export type StrategyRow = {
  id: string;
  scopeId: string;
  strategyType: StrategyType;
  status: StrategyStatus;
  createdAt: string;
  updatedAt: string;
  modules: StrategyModuleRow[];
};

export type ProposeProjectOption = {
  id: string;
  title: string;
  company: string;
  stage: string | null;
  status: string | null;
  bdRecordId: string | null;
};
