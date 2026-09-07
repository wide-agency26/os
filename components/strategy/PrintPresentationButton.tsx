"use client";

import { Button } from "@/components/frappe-ui/primitives";

export function PrintPresentationButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      Print / Save PDF
    </Button>
  );
}
