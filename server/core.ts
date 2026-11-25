import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { Request } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
export const db = new PrismaClient(),
  prod = process.env.NODE_ENV === "production",
  origin = process.env.APP_ORIGIN || "http://localhost:3000",
  secret = process.env.JWT_SECRET || "";
if (secret.length < 32) throw Error("Configure a strong JWT_SECRET");
export const str = z.string().trim().min(1).max(240),
  email = z.email().max(254).toLowerCase(),
  mobile = z.string().regex(/^\+?[0-9]{10,15}$/),
  contact = z.object({ name: str, email, mobile }),
  pw = z.string().min(10).max(72),
  num = z.coerce.number().int().min(0).max(2147483647);
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export const reference = (prefix: string) =>
  prefix + "-" + crypto.randomBytes(8).toString("hex").toUpperCase();
export async function identity(req: Request) {
  let token: { sub?: string; v?: number };
  try {
    token = jwt.verify(req.cookies.session, secret, {
      algorithms: ["HS256"],
    }) as typeof token;
  } catch {
    return null;
  }
  const u = await db.user.findUnique({
    where: { id: token.sub },
    include: {
      role: { include: { permissions: true } },
      customer: true,
      staff: true,
    },
  });
  return u?.version === token.v ? u : null;
}
export async function user(req: Request) {
  return (await identity(req)) || fail(401, "Please sign in to continue.");
}
export const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  mobile: u.mobile,
  sms: u.sms,
  whatsapp: u.whatsapp,
  role: u.role.name,
  verified: u.verified,
  permissions: u.role.permissions?.map((p: any) => p.key) || [],
});
export async function mailToken(id: string, address: string, purpose: string) {
  let raw = crypto.randomBytes(32).toString("hex");
  await db.token.create({
    data: {
      userId: id,
      purpose,
      digest: crypto.createHash("sha256").update(raw).digest("hex"),
      expires: new Date(Date.now() + 3600000),
    },
  });
  if (process.env.SMTP_URL)
    await nodemailer
      .createTransport(process.env.SMTP_URL)
      .sendMail({
        from: process.env.MAIL_FROM,
        to: address,
        subject: "CARBAAZ • " + purpose,
        html:
          '<img width="140" alt="CARBAAZ" src="' +
          origin +
          '/media/brand.webp"><p><a href="' +
          origin +
          "/forgot-password?purpose=" +
          purpose +
          "&token=" +
          raw +
          '">Continue securely</a>. This link expires in one hour.</p>',
      });
}
export const statuses = [
    "Pending",
    "Confirmed",
    "Assigned",
    "In Progress",
    "Completed",
    "Cancelled",
  ],
  sellStates = [
    "Submitted",
    "Under Review",
    "Inspection Scheduled",
    "Offer Generated",
    "Negotiation",
    "Approved",
    "Rejected",
    "Completed",
  ],
  buyStates = [
    "Submitted",
    "Under Review",
    "Contacted",
    "Offer Sent",
    "Approved",
    "Completed",
  ];
export const inventory = { deletedAt: null, sold: false },
  svcInclude = {
    packages: {
      where: { deletedAt: null },
      orderBy: { price: "asc" as const },
    },
  };
