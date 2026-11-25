import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { db, prod, origin, user, fail } from "./core";
import { account } from "./routes/account";
import { shop } from "./routes/shop";
import { erp } from "./routes/erp";
import multer from "multer";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { v2 as cloud } from "cloudinary";
import { checkout, webhook } from "./routes/pay";
import { deliver } from "./services/delivery";
import { ensureLocalDb } from "./ensure-db";
const app = express();
const apiOnly =
  process.env.API_ONLY === "1" || process.argv.includes("--api-only");
const allowedOrigins = new Set(
  [
    origin,
    ...(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ...(!prod
      ? [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5174",
        ]
      : []),
  ].filter(Boolean),
);
app.use((req, res, next) => {
  if (prod && req.hostname === "www.carbaaz.in")
    return res.redirect(308, "https://carbaaz.in" + req.originalUrl);
  next();
});
app.use("/webhooks", webhook);
setInterval(
  () => deliver().catch(() => console.error("Notification delivery deferred")),
  30000,
).unref();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: prod
      ? {
          directives: {
            imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
            frameSrc: ["https://www.google.com"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
          },
        }
      : false,
    strictTransportSecurity: prod ? undefined : false,
  }),
);
app.use(
  "/api",
  rateLimit({ windowMs: 60000, limit: 180 }),
  express.json({ limit: "120kb" }),
  cookieParser(),
  (req, res, next) => {
    const reqOrigin = req.headers.origin;
    if (reqOrigin && allowedOrigins.has(reqOrigin)) {
      res.set("Access-Control-Allow-Origin", reqOrigin);
      res.set("Access-Control-Allow-Credentials", "true");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      );
      res.set("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      reqOrigin &&
      !allowedOrigins.has(reqOrigin)
    )
      return res.status(403).json({ error: "Cross-origin request denied" });
    next();
  },
);
app.get("/api/health", async (_q, r) => {
  await db.$queryRaw`SELECT 1`;
  r.json({ ok: true });
});
app.use("/api", account, shop, checkout);
app.use("/api/admin", erp);
app.post(
  "/api/upload",
  async (req, res, next) => {
    const u = await user(req);
    res.locals.owner = u.id;
    if (
      req.query.scope !== "sell" &&
      !["Admin", "Super Admin"].includes(u.role.name)
    )
      fail(403, "Catalog upload requires an administrator");
    next();
  },
  multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: 6 * 1024 * 1024 },
  }).single("image"),
  async (req, res) => {
    if (!req.file) fail(400, "Choose an image");
    const input = sharp(req.file!.buffer, { limitInputPixels: 24000000 }),
      meta = await input.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || ""))
      fail(400, "Use JPEG, PNG or WebP");
    const bytes = await input
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp()
      .toBuffer();
    const privatePhoto = req.query.scope === "sell",
      name = (privatePhoto ? res.locals.owner + "-" : "") + crypto.randomUUID(),
      folder = privatePhoto ? "carbaaz-private" : "carbaaz";
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const asset = await cloud.uploader.upload(
        "data:image/webp;base64," + bytes.toString("base64"),
        {
          public_id: folder + "/" + name,
          type: privatePhoto ? "authenticated" : "upload",
        },
      );
      res.json({
        url: privatePhoto ? "/api/photos/" + name + ".webp" : asset.secure_url,
      });
    } else {
      if (prod) fail(503, "Image storage unavailable");
      const dir = privatePhoto ? ".local/seller-images" : "uploads";
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(dir + "/" + name + ".webp", bytes);
      res.json({
        url: (privatePhoto ? "/api/photos/" : "/uploads/") + name + ".webp",
      });
    }
  },
);
cloud.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
app.get("/api/photos/:name", async (req, res) => {
  const u = await user(req),
    name = String(req.params.name);
  if (
    !/^[a-z0-9]+-[a-f0-9-]{36}\.webp$/.test(name) ||
    (!name.startsWith(u.id + "-") &&
      !["Manager", "Super Admin", "Admin"].includes(u.role.name))
  )
    fail(404, "Photo unavailable");
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const url = cloud.url("carbaaz-private/" + name, {
      type: "authenticated",
      sign_url: true,
      secure: true,
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) fail(404, "Photo unavailable");
    res.type("webp").send(Buffer.from(await response.arrayBuffer()));
  } else
    res.sendFile(path.resolve(".local/seller-images", name), {
      cacheControl: false,
      dotfiles: "allow",
    });
});
app.use("/uploads", express.static("uploads"));
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Unknown endpoint" }),
);
app.use((e: any, _req: any, res: any, _next: any) => {
  const prisma = e instanceof Prisma.PrismaClientKnownRequestError;
  res
    .status(
      e instanceof ZodError
        ? 400
        : prisma
          ? e.code === "P2025"
            ? 404
            : e.code === "P2002"
              ? 409
              : 400
          : e.status || 500,
    )
    .json({
      error:
        e instanceof ZodError
          ? e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")
          : prisma
            ? e.code === "P2002"
              ? "Already registered or slot no longer available."
              : "Record unavailable."
            : e.status
              ? e.message
              : "Unable to complete request.",
    });
});
app.get("/robots.txt", (_q, r) =>
  r
    .type("text")
    .send(
      "User-agent: *\nDisallow: /admin/\nDisallow: /customer/\nSitemap: https://carbaaz.in/sitemap.xml",
    ),
);
app.get("/sitemap.xml", async (_q, r) => {
  const pages = [
    "",
    "about",
    "services",
    "book-detailing",
    "buy-used-cars",
    "sell-your-car",
    "contact",
    ...(
      await db.service.findMany({ where: { active: true, deletedAt: null } })
    ).map((s) => "services/" + s.slug),
    ...(
      await db.vehicle.findMany({ where: { sold: false, deletedAt: null } })
    ).map((v) => "buy-used-cars/" + v.slug),
  ];
  r.type("xml").send(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      pages
        .map((p) => "<url><loc>https://carbaaz.in/" + p + "</loc></url>")
        .join("") +
      "</urlset>",
  );
});
app.get("/", (_q, r) => r.json({ service: "carbaaz-api", ok: true }));
await ensureLocalDb();
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`[CARBAAZ] Backend server listening on http://localhost:${port}`);
});
