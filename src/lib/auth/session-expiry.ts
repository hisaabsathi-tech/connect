/** Why the server rejected a token, when it says: `replaced` is a sign-in on another phone. */
export type RejectedReason = "replaced";

type RejectedTokenHandler = (token: string, reason?: RejectedReason) => void;

let handler: RejectedTokenHandler | null = null;

/**
 * The API clients call this when the server answers 401 to a request made with `token`: it was
 * revoked (password changed, signed out everywhere, signed in on another phone) or expired. The
 * session provider decides whether it is the signed-in session and, if so, sends the user back
 * to sign in.
 */
export function reportRejectedToken(token: string | null | undefined, reason?: RejectedReason) {
  if (token) handler?.(token, reason);
}

/** Registered once by the session provider. */
export function onRejectedToken(next: RejectedTokenHandler | null) {
  handler = next;
}
