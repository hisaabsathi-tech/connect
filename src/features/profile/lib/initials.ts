/** Up to two initials for the avatar fallback, e.g. "Suman Das" → "SD"; "HS" when empty. */
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HS"
  );
}
