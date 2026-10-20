/** "+91 98765 43210" for an Indian number (10 digits, or 12 starting 91); anything else as given. */
export function formatMobile(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 10
        ? digits
        : null;
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : raw;
}

/** A `tel:` link that opens the phone's dialer on the number; null when it has no digits. */
export function dialUrl(value: string | null | undefined) {
  const number = value?.replace(/[^\d+]/g, "") ?? "";
  return /\d/.test(number) ? `tel:${number}` : null;
}
