import { useEffect, useState } from "react";

import { type AddressSuggestion, autocompleteAddress } from "@/lib/api/maps";

// A pause after the last keystroke before asking the map, as the profile address does.
const SUGGEST_DELAY_MS = 300;

/**
 * Map suggestions for an address being typed, from the server's Ola Maps proxy (the web's
 * address line 1 field uses the same). Empty for fewer than 3 characters, while `enabled` is off
 * (nothing typed since a pick), or when the map can't be reached.
 */
export function useAddressSuggestions(token: string | null, input: string, enabled: boolean) {
  const query = input.trim();
  const wanted = Boolean(token && enabled && query.length >= 3);
  const [result, setResult] = useState<{ items: AddressSuggestion[]; query: string } | null>(null);

  useEffect(() => {
    if (!(wanted && token)) return;
    let active = true;
    const timer = setTimeout(() => {
      autocompleteAddress(query, token)
        .then((items) => {
          if (active) setResult({ items, query });
        })
        .catch(() => {
          if (active) setResult({ items: [], query });
        });
    }, SUGGEST_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, token, wanted]);

  // The last answer stays up while the next is fetched, so the list doesn't flicker.
  return wanted ? (result?.items ?? []) : [];
}
