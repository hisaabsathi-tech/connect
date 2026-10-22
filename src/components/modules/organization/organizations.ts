/** An organization to filter by or pick, by name. */
export type OrganizationChoice = { id: string; name: string };

/**
 * The organizations a loaded list holds, in the order they first appear. A record that doesn't
 * say its organization (saved before it did) is left out.
 */
export function distinctOrganizations(
  items: { organizationId?: string | null; organizationName?: string | null }[],
): OrganizationChoice[] {
  const seen = new Map<string, OrganizationChoice>();
  for (const item of items) {
    const id = item.organizationId;
    if (!id || seen.has(id)) continue;
    seen.set(id, { id, name: item.organizationName?.trim() || "Organization" });
  }
  return [...seen.values()];
}
