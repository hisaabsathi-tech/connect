/**
 * "Delivery Boy" for a code-style label such as "DELIVERY_BOY", "delivery-boy" or "manager":
 * separators become spaces and each word is capitalised. Mixed-case text ("Team Lead") is
 * already readable and keeps its own spelling, and a short all-caps label on its own ("HR") is
 * an acronym and stays as it is.
 */
export function humanizeLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  const mixedCase = text !== text.toUpperCase() && text !== text.toLowerCase();
  const acronym = /^[A-Z]{1,3}$/.test(text);
  if ((!/[_-]/.test(text) && mixedCase) || acronym) return text;
  return text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
