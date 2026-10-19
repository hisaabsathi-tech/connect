export const EMAIL = /^\S+@\S+\.\S+$/;
export const OTP = /^\d{6}$/;
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_MS = 60_000;
export const CHALLENGE_EXPIRED_MESSAGE = "Your sign-in challenge expired. Please sign in again.";
