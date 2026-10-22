import { useEffect, useState } from "react";

import { checkSheetIdentifiers, type IdentifierClash } from "@/lib/api/smart-sheets";

// A pause after the last keystroke, so typing a number doesn't check every character.
const CHECK_DELAY_MS = 400;

export type IdentifierCheck = {
  /** Null while there's nothing to check (empty, kept as it was, malformed) or offline. */
  status: "checking" | "valid" | "invalid" | null;
  /** Where it's already taken, when it is. */
  clash: IdentifierClash;
};

const IDLE: IdentifierCheck = { clash: null, status: null };

/**
 * The web Smart Sheet's duplicate check for an AWB or reference number as one is typed: free, or
 * already an order's, or another order's in this sheet. `skip` leaves a value out (empty, kept as
 * the sheet has it, or not well formed). Unreachable, it stays unchecked rather than marked wrong;
 * the server checks again on save.
 */
export function useIdentifierCheck({
  field,
  organizationId,
  row,
  sheetId,
  skip,
  token,
  value,
}: {
  field: "awbNo" | "refNo";
  organizationId: string;
  /** The order being edited, which keeps its own number. */
  row?: number;
  /** The sheet the order goes into, once there is one. */
  sheetId?: string;
  skip: boolean;
  token: string | null;
  value: string;
}): IdentifierCheck {
  const wanted = value.trim();
  const active = Boolean(token && organizationId && wanted && !skip);
  const key = `${field}|${wanted}|${sheetId ?? ""}|${row ?? ""}`;
  const [result, setResult] = useState<{ check: IdentifierCheck; key: string } | null>(null);

  useEffect(() => {
    if (!(active && token)) return;
    let current = true;
    const timer = setTimeout(() => {
      checkSheetIdentifiers(token, organizationId, { [field]: wanted, row, sheetId })
        .then((found) => {
          const clash = found[field];
          if (current) setResult({ check: { clash, status: clash ? "invalid" : "valid" }, key });
        })
        .catch(() => {
          if (current) setResult({ check: IDLE, key });
        });
    }, CHECK_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [active, field, key, organizationId, row, sheetId, token, wanted]);

  if (!active) return IDLE;
  // A result for an earlier value doesn't count; this one is still being checked.
  return result?.key === key ? result.check : { clash: null, status: "checking" };
}

/** What to tell them about a taken number. */
export function clashMessage(field: "awbNo" | "refNo", clash: IdentifierClash) {
  const what = field === "awbNo" ? "This AWB number" : "This reference number";
  if (clash === "order") return `${what} is already used by an order`;
  if (clash === "sheet") return `${what} is already in this sheet`;
  return null;
}
