import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import {
  db,
  user,
  identity,
  publicUser,
  mailToken,
  email,
  pw,
  str,
  mobile,
  secret,
  prod,
  fail,
} from "../core";
export const account = Router();
account.use("/auth", rateLimit({ windowMs: 900000, limit: 75 }));
account.get("/me", async (req, res) => {
  const u = await identity(req);
  res.json(u ? publicUser(u) : null);
});
account.post("/auth/register", async (req, res) => {
  const b = z.object({ email, password: pw, name: str }).parse(req.body);
  const u = await db.user.create({
    data: {
      email: b.email,
      name: b.name,
      hash: await bcrypt.hash(b.password, 12),
      role: { connect: { name: "Customer" } },
      customer: { create: {} },
    },
  });
  await mailToken(u.id, u.email, "verify");
  res.status(201).json({ message: "Account created. You can sign in now." });
});
account.post("/auth/login", async (req, res) => {
  const b = z
    .object({
      email,
      password: z.string().max(100),
      remember: z.boolean().optional(),
    })
    .parse(req.body);
  let u = await db.user.findUnique({
    where: { email: b.email },
    include: { role: { include: { permissions: true } } },
  });
  if (!u || !(await bcrypt.compare(b.password, u.hash)))
    return fail(401, "Incorrect email or password.");
  let age = b.remember ? 2592000 : 28800;
  res
    .cookie(
      "session",
      jwt.sign({ sub: u.id, v: u.version }, secret, { expiresIn: age }),
      {
        httpOnly: true,
        secure: prod,
        sameSite: "lax",
        path: "/",
        ...(b.remember ? { maxAge: age * 1000 } : {}),
      },
    )
    .json(publicUser(u));
});
account.post("/auth/logout", async (req, res) => {
  const u = await identity(req);
  if (u)
    await db.user.update({
      where: { id: u.id },
      data: { version: { increment: 1 } },
    });
  res.clearCookie("session", { path: "/" }).json({ ok: true });
});
account.post("/auth/recover", async (req, res) => {
  const u = await db.user.findUnique({
    where: { email: email.parse(req.body.email) },
  });
  if (u) await mailToken(u.id, u.email, "reset");
  res.json({
    message: "If your email is registered, a recovery link will be sent.",
  });
});
account.post("/auth/token", async (req, res) => {
  const b = z
    .object({
      token: z.string().length(64),
      purpose: z.enum(["reset", "verify"]),
      password: pw.optional(),
    })
    .parse(req.body);
  const digest = crypto.createHash("sha256").update(b.token).digest("hex");
  await db.$transaction(async (tx) => {
    const t = await tx.token.findUnique({ where: { digest } });
    if (!t || t.purpose !== b.purpose || t.expires < new Date())
      return fail(400, "Link expired or invalid.");
    await tx.token.delete({ where: { id: t.id } });
    await tx.user.update({
      where: { id: t.userId },
      data:
        b.purpose === "verify"
          ? { verified: true }
          : {
              hash: await bcrypt.hash(pw.parse(b.password), 12),
              version: { increment: 1 },
            },
    });
  });
  res.json({ message: "Account updated." });
});
account.patch("/profile", async (req, res) => {
  const u = await user(req);
  await db.user.update({
    where: { id: u.id },
    data: z
      .object({
        name: str,
        mobile,
        sms: z.boolean().optional(),
        whatsapp: z.boolean().optional(),
      })
      .parse(req.body),
  });
  res.json({ message: "Profile saved." });
});
account.get("/customer", async (req, res) => {
  const u = await user(req),
    customerId = u.customer?.id || fail(403, "Customer account required");
  const [bookings, enquiries, wishlist, notifications] = await Promise.all([
    db.booking.findMany({
      where: { customerId },
      include: {
        items: { include: { package: { include: { service: true } } } },
      },
      orderBy: { starts: "desc" },
    }),
    db.enquiry.findMany({
      where: { customerId },
      omit: { internalNotes: true },
      include: { sell: true, buy: { include: { vehicle: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.wishlist.findMany({
      where: { userId: u.id, vehicle: { deletedAt: null } },
      include: { vehicle: { include: { images: true } } },
    }),
    db.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  res.json({ bookings, enquiries, wishlist, notifications });
});
account.post("/wishlist/:id", async (req, res) => {
  const u = await user(req);
  const vehicleId = String(req.params.id),
    where = { userId_vehicleId: { userId: u.id, vehicleId } };
  if (await db.wishlist.findUnique({ where }))
    await db.wishlist.delete({ where });
  else {
    await db.vehicle.findFirstOrThrow({
      where: { id: vehicleId, sold: false, deletedAt: null },
    });
    await db.wishlist.create({ data: where.userId_vehicleId });
  }
  res.json({ message: "Wishlist updated." });
});
