import { apiRequest } from "@/lib/api/client";

/** Where an Indian pincode is, from the postal directory. */
export type PostalPlace = { city: string; pincode: string; state: string };

type PostalResponse = {
  Status?: string;
  PostOffice?: { District?: string; Pincode?: string; State?: string }[] | null;
};

// One lookup per pincode for the app run, as the web's `lookupPostalPincode` keeps; a failed one
// is forgotten so it can be tried again.
const lookups = new Map<string, Promise<PostalPlace | null>>();

/**
 * The web app's pincode check: the postal directory's district and state for the pincode, or null
 * when it has no post office there (a pincode that doesn't exist). Throws when the server can't be
 * reached, so a dropped connection isn't taken for a wrong pincode.
 */
export function lookUpPostalPincode(token: string, pincode: string) {
  const key = pincode.trim();
  let lookup = lookups.get(key);
  if (!lookup) {
    lookup = apiRequest<PostalResponse[]>(`/pincodes/postal/${encodeURIComponent(key)}`, token)
      .then((results) => {
        for (const result of Array.isArray(results) ? results : []) {
          const office = result.Status === "Success" ? result.PostOffice?.[0] : undefined;
          if (office)
            return {
              city: office.District?.trim() ?? "",
              pincode: office.Pincode?.trim() || key,
              state: office.State?.trim() ?? "",
            };
        }
        return null;
      })
      .catch((error: unknown) => {
        lookups.delete(key);
        throw error;
      });
    lookups.set(key, lookup);
  }
  return lookup;
}
