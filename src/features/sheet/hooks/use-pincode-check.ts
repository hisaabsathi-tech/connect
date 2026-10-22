import { useEffect, useState } from "react";

import { lookUpPostalPincode, type PostalPlace } from "@/lib/api/pincodes";

// A pause after the last digit, so editing a pincode doesn't look up every step.
const CHECK_DELAY_MS = 300;

export type PincodeCheck = {
  /** Null while the pincode isn't 6 digits, or couldn't be checked (offline). */
  status: "checking" | "valid" | "invalid" | null;
  /** The district and state of a valid pincode. */
  place: PostalPlace | null;
};

const IDLE: PincodeCheck = { place: null, status: null };

/**
 * The web app's pincode check as one is typed: once it has 6 digits, the postal directory says
 * whether it exists (and where). Unreachable, it stays unchecked rather than marked wrong.
 */
export function usePincodeCheck(token: string | null, pincode: string): PincodeCheck {
  const digits = pincode.trim();
  const complete = /^\d{6}$/.test(digits);
  const [result, setResult] = useState<{ check: PincodeCheck; pincode: string } | null>(null);

  useEffect(() => {
    if (!(token && complete)) return;
    let active = true;
    const timer = setTimeout(() => {
      lookUpPostalPincode(token, digits)
        .then((place) => {
          if (active)
            setResult({
              check: { place, status: place ? "valid" : "invalid" },
              pincode: digits,
            });
        })
        .catch(() => {
          if (active) setResult({ check: IDLE, pincode: digits });
        });
    }, CHECK_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [complete, digits, token]);

  if (!(token && complete)) return IDLE;
  // A result for an earlier pincode doesn't count; this one is still being checked.
  return result?.pincode === digits ? result.check : { place: null, status: "checking" };
}
