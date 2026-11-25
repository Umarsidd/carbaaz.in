import { Router } from "express";
import { z } from "zod";
import {
  db,
  user,
  identity,
  fail,
  str,
  num,
  contact,
  reference,
  inventory,
  svcInclude,
  statuses,
} from "../core";
export const shop = Router();
shop.get("/catalog", async (_req, res) => {
  const [services, cars, gallery, testimonials, settings, reviews] =
    await Promise.all([
      db.service.findMany({
        where: { deletedAt: null, active: true },
        include: svcInclude,
        orderBy: { createdAt: "asc" },
      }),
      db.vehicle.findMany({
        where: inventory,
        include: { images: true },
        orderBy: { featured: "desc" },
      }),
      db.gallery.findMany(),
      db.testimonial.findMany(),
      db.websiteSetting.findMany(),
      db.review.findMany(),
    ]);
  res.json({
    services,
    cars: cars.map((c) => ({
      ...c,
      registration: c.registration ? "•••• " + c.registration.slice(-4) : "",
    })),
    gallery,
    testimonials,
    reviews,
    settings: Object.fromEntries(settings.map((s) => [s.name, s.value])),
  });
});
const date = z.iso.date();
function times(day: string, duration: number) {
  date.parse(day);
  return Array.from(
    { length: 18 },
    (_, i) => new Date(Date.parse(day + "T09:00:00+05:30") + i * 1800000),
  ).filter(
    (t, i) =>
      t > new Date() &&
      +t < Date.now() + 90 * 86400000 &&
      i * 30 + duration <= 540,
  );
}
const blocks = (t: Date, duration: number) =>
  Array.from(
    { length: Math.ceil(duration / 30) },
    (_, i) => new Date(+t + 1800000 * i),
  );
shop.get("/slots", async (req, res) => {
  const day = date.parse(req.query.date),
    s = await db.service.findFirstOrThrow({
      where: {
        id: str.parse(req.query.service),
        active: true,
        deletedAt: null,
      },
    });
  const available = times(day, s.duration),
    taken = await db.bookingSlot.findMany({
      where: {
        starts: { in: available.flatMap((t) => blocks(t, s.duration)) },
        bookingId: {
          not: typeof req.query.exclude === "string" ? req.query.exclude : "",
        },
      },
    });
  res.json(
    available.filter((t) =>
      blocks(t, s.duration).every((b) => !taken.some((x) => +x.starts === +b)),
    ),
  );
});
const v = z.object({
  manufacturer: str,
  model: str,
  registration: str,
  type: str,
});
function validStart(starts: Date, duration: number) {
  const day = new Date(+starts + 19800000).toISOString().slice(0, 10);
  if (!times(day, duration).some((t) => +t === +starts))
    fail(400, "Choose an available workshop slot.");
}
shop.post("/bookings", async (req, res) => {
  const u = await user(req),
    customerId = u.customer?.id || fail(403, "Customer account required");
  const b = z
    .object({
      vehicle: v,
      packageId: str,
      starts: z.coerce.date(),
      contact: contact.extend({
        instructions: z.string().max(2000).optional(),
      }),
    })
    .parse(req.body);
  const p = await db.servicePackage.findFirstOrThrow({
    where: {
      id: b.packageId,
      deletedAt: null,
      service: { active: true, deletedAt: null },
    },
    include: { service: true },
  });
  validStart(b.starts, p.service.duration);
  const ref = reference("CB");
  await db.$transaction([
    db.booking.create({
      data: {
        reference: ref,
        starts: b.starts,
        vehicle: b.vehicle,
        contact: b.contact,
        customerId,
        items: {
          create: {
            packageId: p.id,
            price: p.price,
            duration: p.service.duration,
          },
        },
        slots: {
          create: blocks(b.starts, p.service.duration).map((starts) => ({
            starts,
          })),
        },
      },
    }),
    db.notification.create({
      data: { userId: u.id, message: "Booking received: " + ref },
    }),
  ]);
  res.status(201).json({ reference: ref });
});
shop.patch("/bookings/:id", async (req, res) => {
  const u = await user(req),
    admin = ["Admin", "Super Admin", "Manager"].includes(u.role.name),
    b = z
      .object({
        status: z.enum(statuses as [string, ...string[]]).optional(),
        starts: z.coerce.date().optional(),
        staffId: str.optional(),
      })
      .parse(req.body);
  await db.$transaction(async (tx) => {
    const r = await tx.booking.findFirstOrThrow({
      where: {
        id: String(req.params.id),
        ...(admin
          ? {}
          : { customerId: u.customer?.id || fail(403, "Forbidden") }),
      },
      include: { items: true, customer: true },
    });
    if (
      !admin &&
      (b.staffId ||
        (b.status && b.status !== "Cancelled") ||
        !["Pending", "Confirmed"].includes(r.status))
    )
      return fail(403, "This booking cannot be changed.");
    if (["Completed", "Cancelled"].includes(r.status))
      return fail(409, "Booking already closed.");
    await tx.booking.update({
      where: { id: r.id, updatedAt: r.updatedAt },
      data: b,
    });
    if (b.starts || b.status === "Cancelled") {
      await tx.bookingSlot.deleteMany({ where: { bookingId: r.id } });
      if (b.status !== "Cancelled" && b.starts) {
        validStart(b.starts, r.items[0].duration);
        await tx.bookingSlot.createMany({
          data: blocks(b.starts, r.items[0].duration).map((starts) => ({
            starts,
            bookingId: r.id,
          })),
        });
      }
    }
    await tx.notification.create({
      data: {
        userId: r.customer.userId,
        message: r.reference + " • " + (b.status || "Appointment updated"),
      },
    });
    await tx.activityLog.create({
      data: { actor: u.id, action: "Booking updated", recordId: r.id },
    });
  });
  res.json({ message: "Booking updated." });
});
const image = z
  .string()
  .regex(
    /^\/(api\/photos)\/[a-zA-Z0-9_-]+\.(webp|png)$|^https:\/\/res\.cloudinary\.com\//,
  );
export const vehicleFields = z.object({
  manufacturer: str,
  model: str,
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  km: num,
  fuel: str,
  transmission: str,
  ownership: str,
  registration: str,
  price: num,
  description: z.string().max(5000),
});
shop.post("/enquiries", async (req, res) => {
  const u = await identity(req),
    b = contact
      .extend({
        kind: z.enum(["Buy", "Sell", "Contact", "Service"]),
        message: z.string().max(4000),
        vehicleId: str.optional(),
        details: vehicleFields.optional(),
        images: z.array(image).max(8).default([]),
      })
      .parse(req.body);
  if (
    b.images.length &&
    (!u ||
      b.kind !== "Sell" ||
      b.images.some((url) => !url.startsWith("/api/photos/" + u.id + "-")))
  )
    fail(400, "Invalid seller photo");
  if (b.kind === "Buy")
    await db.vehicle.findFirstOrThrow({
      where: { id: str.parse(b.vehicleId), ...inventory },
    });
  if (b.kind === "Sell") vehicleFields.parse(b.details);
  const ref = reference("EQ");
  await db.$transaction(async (tx) => {
    await tx.enquiry.create({
      data: {
        reference: ref,
        customerId: u?.customer?.id,
        name: b.name,
        mobile: b.mobile,
        email: b.email,
        kind: b.kind,
        message: b.message,
        history: [{ status: "Submitted", at: new Date().toISOString() }],
        ...(b.kind === "Buy"
          ? { buy: { create: { vehicleId: b.vehicleId! } } }
          : b.kind === "Sell"
            ? { sell: { create: { details: b.details!, images: b.images } } }
            : {}),
      },
    });
    if (u)
      await tx.notification.create({
        data: { userId: u.id, message: "Request received: " + ref },
      });
  });
  res.status(201).json({ reference: ref });
});
shop.post("/track", async (req, res) => {
  const b = z
    .object({ reference: str, mobile: contact.shape.mobile })
    .parse(req.body);
  const r = await db.enquiry.findFirst({
    where: b,
    select: {
      reference: true,
      kind: true,
      status: true,
      history: true,
      createdAt: true,
      updatedAt: true,
      remarks: true,
    },
  });
  res.json(r || fail(404, "No matching request. Check both details."));
});
shop.post("/newsletter", async (req, res) => {
  const address = z.email().toLowerCase().parse(req.body.email);
  await db.subscriber.upsert({
    where: { email: address },
    create: { email: address },
    update: {},
  });
  res.json({ message: "You are subscribed." });
});
