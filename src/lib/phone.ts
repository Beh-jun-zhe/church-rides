function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

export function normalizePhone(input: string) {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("+")) {
    const normalized = `+${digitsOnly(value.slice(1))}`;
    if (/^\+[1-9]\d{7,14}$/.test(normalized)) {
      return normalized;
    }
    return null;
  }

  const digits = digitsOnly(value);

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

export function formatPhoneForDisplay(input: string | null | undefined) {
  if (!input) {
    return "None";
  }

  const normalized = normalizePhone(input);
  if (!normalized) {
    return input;
  }

  if (/^\+1\d{10}$/.test(normalized)) {
    const digits = normalized.slice(2);
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return normalized;
}
