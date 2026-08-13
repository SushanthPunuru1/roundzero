"use client";

import { Printer } from "lucide-react";
import { Button } from "@roundzero/ui";

export function PrintButton() {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
      <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      Print
    </Button>
  );
}
