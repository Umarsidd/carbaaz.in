// Optional transactional relay. Each channel receives its own stable idempotency key.
import { db, origin } from "../core";
export async function deliver() {
  if (
    !process.env.NOTIFICATION_RELAY_URL ||
    !process.env.NOTIFICATION_RELAY_TOKEN
  )
    return;
  const url = new URL(process.env.NOTIFICATION_RELAY_URL);
  if (url.protocol !== "https:")
    throw Error("Notification relay requires HTTPS");
  const rows = await db.notification.findMany({
    where: {
      deliveredAt: null,
      retryAt: { lte: new Date() },
      attempts: { lt: 8 },
    },
    include: { user: true },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  for (const n of rows) {
    const lease = await db.notification.updateMany({
      where: { id: n.id, attempts: n.attempts, deliveredAt: null },
      data: {
        retryAt: new Date(
          Date.now() + Math.min(86400000, 60000 * 2 ** n.attempts),
        ),
        attempts: { increment: 1 },
      },
    });
    if (!lease.count) continue;
    const destinations = [
      ...(n.user.verified ? [["email", n.user.email]] : []),
      ...(n.user.mobile && n.user.sms ? [["sms", n.user.mobile]] : []),
      ...(n.user.mobile && n.user.whatsapp
        ? [["whatsapp", n.user.mobile]]
        : []),
    ];
    for (const [channel, to] of destinations) {
      const resp = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: "Bearer " + process.env.NOTIFICATION_RELAY_TOKEN,
          "Content-Type": "application/json",
          "Idempotency-Key": n.id + "-" + channel,
        },
        body: JSON.stringify({
          channel,
          to,
          message: n.message,
          logo: origin + "/media/brand.webp",
        }),
      });
      if (!resp.ok) throw Error("Notification relay unavailable");
    }
    await db.notification.update({
      where: { id: n.id },
      data: { deliveredAt: new Date() },
    });
  }
}
