import { cookies } from "next/headers";

export type FlashTone = "success" | "error" | "info";

export interface FlashMessage {
  id: string;
  tone: FlashTone;
  text: string;
}

const FLASH_COOKIE = "flash_message";

function randomFlashId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function setFlashMessage(input: { tone: FlashTone; text: string }) {
  const cookieStore = await cookies();
  const payload: FlashMessage = {
    id: randomFlashId(),
    tone: input.tone,
    text: input.text,
  };

  cookieStore.set(FLASH_COOKIE, JSON.stringify(payload), {
    path: "/",
    maxAge: 8,
    sameSite: "lax",
  });
}

export async function readFlashMessage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (!parsed?.id || !parsed?.tone || !parsed?.text) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
