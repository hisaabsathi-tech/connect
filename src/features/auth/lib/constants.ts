export const EMAIL = /^\S+@\S+\.\S+$/;
export const OTP = /^\d{6}$/;
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_MS = 60_000;
/** How long an emailed code stays valid; mirrors the server's emailOTP `expiresIn` (600s). */
export const OTP_TTL_MS = 600_000;
export const CHALLENGE_EXPIRED_MESSAGE = "Your sign-in challenge expired. Please sign in again.";
export const NO_ORGANIZATION_MESSAGE =
  "You are not assigned to any organization. Please contact your administrator.";
