/** "850 m", "4.2 km", "12 km"; "~" marks a straight-line estimate. */
export function formatDistance(metres: number, estimated = false) {
  const value =
    metres < 1000
      ? `${Math.max(10, Math.round(metres / 10) * 10)} m`
      : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
  return estimated ? `~${value}` : value;
}
