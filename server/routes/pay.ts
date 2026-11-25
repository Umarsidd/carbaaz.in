import Stripe from "stripe";
import express from "express";
import { db, user, fail, origin } from "../core";
function gateway() {
  return new Stripe(
    process.env.STRIPE_SECRET_KEY ||
      fail(503, "Online payment is unavailable."),
    process.env.NODE_ENV !== "production" && process.env.STRIPE_LOCAL_PORT
      ? {
          host: "127.0.0.1",
          port: Number(process.env.STRIPE_LOCAL_PORT),
          protocol: "http",
        }
      : {},
  );
}
export const webhook = express.Router();
webhook.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event: Stripe.Event;
    const stripe = gateway(),
      secret =
        process.env.STRIPE_WEBHOOK_SECRET ||
        fail(503, "Webhook not configured");
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        String(req.headers["stripe-signature"]),
        secret,
      );
    } catch {
      return res.sendStatus(400);
    }
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        const p = await db.payment.findUnique({
          where: { reference: session.metadata?.reference || "" },
          include: { booking: { include: { customer: true } } },
        });
        if (
          !p ||
          session.amount_total !== p.amount * 100 ||
          session.currency !== "inr"
        )
          return res.sendStatus(400);
        await db.$transaction(async (tx) => {
          const changed = await tx.payment.updateMany({
            where: { id: p.id, status: "Pending" },
            data: { status: "Paid" },
          });
          if (changed.count) {
            await tx.transaction.create({
              data: {
                paymentId: p.id,
                kind: "Payment",
                amount: p.amount,
                description: session.id,
              },
            });
            await tx.notification.create({
              data: {
                userId: p.booking!.customer.userId,
                message: "Payment received for " + p.booking!.reference,
              },
            });
          }
        });
      }
    }
    res.sendStatus(200);
  },
);
export const checkout = express.Router();
checkout.post("/checkout/:id", async (req, res) => {
  const u = await user(req),
    stripe = gateway();
  const b = await db.booking.findFirstOrThrow({
    where: {
      id: String(req.params.id),
      customerId: u.customer?.id || fail(403, "Customer account required"),
      status: { in: ["Confirmed", "Assigned", "In Progress", "Completed"] },
    },
    include: { items: true, payments: true },
  });
  if (b.payments.some((p) => p.status === "Paid")) fail(409, "Already paid");
  const amount = b.items.reduce((a, i) => a + i.price, 0),
    ref = "WEB-" + b.reference;
  await db.payment.upsert({
    where: { reference: ref },
    create: { reference: ref, bookingId: b.id, amount, status: "Pending" },
    update: {},
  });
  const product = await stripe.products.create(
    { name: "CARBAAZ detailing " + b.reference },
    { idempotencyKey: ref + "-product" },
  );
  const price = await stripe.prices.create(
    { product: product.id, unit_amount: amount * 100, currency: "inr" },
    { idempotencyKey: ref + "-price" },
  );
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price: price.id,
        },
      ],
      metadata: { reference: ref },
      success_url: origin + "/customer/bookings",
      cancel_url: origin + "/customer/bookings",
    },
    { idempotencyKey: ref },
  );
  res.json({ url: session.url });
});
