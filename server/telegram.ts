const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || "http://localhost:8001";

export async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram error:", data.description);
    }
    return data;
  } catch (error) {
    console.error("Telegram send error:", error);
  }
}

export async function getTelegramStatus() {
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/status`);
    return await res.json();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function configureTelegram(api_id: number, api_hash: string, phone: string) {
  const res = await fetch(`${TELEGRAM_API_URL}/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_id, api_hash, phone }),
  });
  return await res.json();
}

export async function sendTelegramCode() {
  const res = await fetch(`${TELEGRAM_API_URL}/send-code`, { method: "POST" });
  return await res.json();
}

export async function signInTelegram(code: string, password?: string) {
  const res = await fetch(`${TELEGRAM_API_URL}/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password }),
  });
  return await res.json();
}

export async function sendTelegramMessageTo(receiver: string, message: string, parse_mode = "html") {
  const res = await fetch(`${TELEGRAM_API_URL}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiver, message, parse_mode }),
  });
  return await res.json();
}

export async function sendToTelegramChannel(channel: string, message: string, parse_mode = "html") {
  const res = await fetch(`${TELEGRAM_API_URL}/channel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, message, parse_mode }),
  });
  return await res.json();
}

export async function getTelegramDialogs(limit = 50) {
  const res = await fetch(`${TELEGRAM_API_URL}/dialogs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  return await res.json();
}

export async function getTelegramHistory(entity: string, limit = 100) {
  const res = await fetch(`${TELEGRAM_API_URL}/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, limit }),
  });
  return await res.json();
}

export async function joinTelegramChannel(channel_link: string) {
  const res = await fetch(`${TELEGRAM_API_URL}/join-channel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_link }),
  });
  return await res.json();
}

export async function disconnectTelegram() {
  const res = await fetch(`${TELEGRAM_API_URL}/disconnect`, { method: "POST" });
  return await res.json();
}
