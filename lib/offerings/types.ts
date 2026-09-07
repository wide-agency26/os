export type OfferingKind = "package" | "service";

export type OfferingInput = {
  kind: OfferingKind;
  catalogId: string;
};

export type OfferingChip = OfferingInput & {
  name: string;
  category?: string | null;
};

export type CatalogPackage = {
  id: string;
  name: string;
  serviceIds: string[];
  sortOrder: number;
};

export type CatalogService = {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
};

export type CatalogOfferings = {
  packages: CatalogPackage[];
  services: CatalogService[];
};
