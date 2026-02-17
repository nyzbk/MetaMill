import type { Response } from "express";

interface NotificationEvent {
  type: "publish_success" | "publish_failed" | "engagement_update";
  data: Record<string, any>;
  timestamp: string;
}

const clients = new Map<string, Set<Response>>();

export function addSSEClient(userId: string, res: Response) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      clients.get(userId)?.delete(res);
    }
  }, 30000);

  res.on("close", () => {
    clearInterval(heartbeat);
    clients.get(userId)?.delete(res);
    if (clients.get(userId)?.size === 0) {
      clients.delete(userId);
    }
  });
}

export function sendNotification(userId: string, event: NotificationEvent) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  userClients.forEach(client => {
    try {
      client.write(payload);
    } catch {
      userClients.delete(client);
    }
  });
}

export function notifyPublishSuccess(userId: string, postCount: number, accountUsername: string) {
  sendNotification(userId, {
    type: "publish_success",
    data: { postCount, accountUsername },
    timestamp: new Date().toISOString(),
  });
}

export function notifyPublishFailed(userId: string, error: string, accountUsername: string) {
  sendNotification(userId, {
    type: "publish_failed",
    data: { error, accountUsername },
    timestamp: new Date().toISOString(),
  });
}

export function notifyEngagementUpdate(userId: string, postId: number, metrics: Record<string, number>) {
  sendNotification(userId, {
    type: "engagement_update",
    data: { postId, ...metrics },
    timestamp: new Date().toISOString(),
  });
}
