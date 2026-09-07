export type PdfRequest =
  | { kind: "ci"; slug: string; projectId?: never; category?: never }
  | { kind: "ci"; projectId: string; slug?: never; category?: never }
  | { kind: "report"; projectId: string; category?: string; slug?: never };
