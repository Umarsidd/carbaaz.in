import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  db,
  user,
  fail,
  str,
  num,
  email,
  pw,
  buyStates,
  sellStates,
  svcInclude,
} from "../core";
import { vehicleFields } from "./shop";
import Excel from "exceljs";
import PDF from "pdfkit";
export const erp = Router();
const mods: Record<string, string> = {
  services: "service",
  packages: "servicePackage",
  cars: "vehicle",
  bookings: "booking",
  customers: "customer",
  staff: "staff",
  "buy-enquiries": "enquiry",
  "sell-requests": "enquiry",
  payments: "payment",
  sales: "transaction",
  reviews: "review",
  testimonials: "testimonial",
  gallery: "gallery",
  settings: "websiteSetting",
  activity: "activityLog",
  notifications: "notification",
  permissions: "role",
};
erp.use(async (req, res, next) => {
  const u = await user(req),
    m = req.path.split("/")[1];
  if (
    !["Admin", "Super Admin"].includes(u.role.name) &&
    !(
      u.role.name === "Manager" &&
      [
        "dashboard",
        "reports",
        "services",
        "cars",
        "packages",
        "customers",
        "bookings",
        "buy-enquiries",
        "sell-requests",
        "staff",
      ].includes(m) &&
      req.method === "GET"
    ) &&
    !(
      u.role.name === "Staff" &&
      req.method === "GET" &&
      (m === "bookings" ||
        (["services", "cars", "packages", "gallery"].includes(m) &&
          u.role.permissions.some((p) => p.key === m)))
    )
  )
    return fail(403, "Your role cannot access this module.");
  res.locals.u = u;
  next();
});
const safeUser = {
  select: {
    name: true,
    email: true,
    mobile: true,
    verified: true,
    role: { select: { name: true } },
  },
};
async function metrics(days: number) {
  const from = new Date(Date.now() - days * 86400000);
  const [bookings, customers, cars, enquiries, sales, payments] =
    await Promise.all([
      db.booking.findMany({
        where: { createdAt: { gte: from } },
        select: {
          createdAt: true,
          status: true,
          items: {
            select: {
              package: { select: { service: { select: { name: true } } } },
            },
          },
        },
      }),
      db.customer.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      db.vehicle.count({ where: { deletedAt: null, sold: false } }),
      db.enquiry.count({ where: { createdAt: { gte: from } } }),
      db.transaction.findMany({
        where: { kind: "Sale", createdAt: { gte: from } },
      }),
      db.payment.findMany({
        where: { status: "Paid", createdAt: { gte: from } },
      }),
    ]);
  const months: Record<string, any> = {};
  for (let i = 0; i <= days; i++) {
    const m = new Date(+from + i * 86400000).toISOString().slice(0, 7);
    months[m] = { month: m, bookings: 0, revenue: 0, sales: 0, customers: 0 };
  }
  for (const [list, key] of [
    [bookings, "bookings"],
    [payments, "revenue"],
    [sales, "sales"],
    [customers, "customers"],
  ] as const)
    for (const r of list)
      months[r.createdAt.toISOString().slice(0, 7)][key] +=
        "amount" in r && key === "revenue" ? r.amount : 1;
  return {
    bookings: bookings.length,
    customers: customers.length,
    cars,
    enquiries,
    sales: sales.length,
    revenue: payments.reduce((a, b) => a + b.amount, 0),
    servicePerformance: bookings
      .flatMap((b) => b.items.map((i) => i.package.service.name))
      .reduce<Record<string, number>>(
        (counts, name) => ({ ...counts, [name]: (counts[name] || 0) + 1 }),
        {},
      ),
    months: Object.values(months),
    activity: await db.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  };
}
erp.get(["/dashboard", "/reports"], async (req, res) => {
  const r = await metrics(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(730)
      .parse(req.query.days || 365),
  );
  if (req.query.format === "xlsx") {
    const wb = new Excel.Workbook(),
      ws = wb.addWorksheet("CARBAAZ");
    ws.addRow(["Month", "Bookings", "Revenue (INR)", "Sales", "Customers"]);
    r.months.forEach((m) => ws.addRow(Object.values(m)));
    res.attachment("carbaaz-report.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } else if (req.query.format === "pdf") {
    res.attachment("carbaaz-report.pdf");
    const doc = new PDF();
    doc.pipe(res);
    doc.fontSize(22).text("CARBAAZ | Business report").moveDown();
    for (const m of r.months)
      doc
        .fontSize(11)
        .text(
          m.month +
            "   Bookings: " +
            m.bookings +
            "   Revenue: INR " +
            m.revenue +
            "   Sales: " +
            m.sales,
        );
    doc.end();
  } else res.json(r);
});
erp.get("/:mod", async (req, res) => {
  const m = String(req.params.mod),
    key = mods[m] || fail(404, "Module not found");
  const where: any = ["services", "cars", "packages"].includes(m)
    ? { deletedAt: null }
    : m === "sell-requests"
      ? { kind: "Sell" }
      : m === "buy-enquiries"
        ? { kind: { not: "Sell" } }
        : {};
  if (res.locals.u.role.name === "Staff" && m === "bookings")
    where.staffId =
      res.locals.u.staff?.id || fail(403, "Staff profile required");
  const include: any = {
    services: svcInclude,
    cars: { images: true },
    packages: { service: true },
    bookings: {
      items: { include: { package: true } },
      staff: { include: { user: safeUser } },
    },
    customers: { user: safeUser, bookings: true, enquiries: true },
    staff: { user: safeUser, _count: { select: { bookings: true } } },
    "buy-enquiries": { buy: { include: { vehicle: true } } },
    "sell-requests": { sell: true },
    permissions: { permissions: true },
    payments: { transactions: true },
  };
  res.json(
    await (db as any)[key].findMany({
      where,
      include: include[m],
      orderBy: { createdAt: "desc" },
    }),
  );
});
const image = z
    .string()
    .regex(
      /^\/(media|uploads)\/[\w-]+\.(webp|png)$|^https:\/\/res\.cloudinary\.com\//,
    ),
  slug = str.regex(/^[a-z0-9-]+$/),
  bool = z.boolean();
const schemas: Record<string, z.ZodTypeAny> = {
  services: z.object({
    name: str,
    slug,
    description: str,
    image,
    duration: z.coerce.number().int().min(30).max(540),
    benefits: z.array(str),
    introduction: z.string().max(4000).optional(),
    process: z.array(str).optional(),
    beforeImage: image.nullish(),
    afterImage: image.nullish(),
    active: bool,
  }),
  packages: z.object({ name: str, price: num, serviceId: str }),
  cars: vehicleFields.extend({
    slug,
    bodyType: str,
    featured: bool,
    sold: bool,
    features: z.array(str),
    images: z.array(image).min(1).max(12),
  }),
  payments: z.object({
    reference: str,
    amount: num,
    status: z.enum(["Pending", "Paid", "Refunded"]),
    bookingId: str.optional(),
  }),
  sales: z.object({
    kind: z.enum(["Sale", "Purchase", "Refund"]),
    description: str,
    amount: num,
  }),
  gallery: z.object({ name: str, value: image }),
  reviews: z.object({ name: str, value: str, serviceId: str.optional() }),
  testimonials: z.object({ name: str, value: str }),
  settings: z.object({
    name: z.enum([
      "address",
      "phone",
      "email",
      "hours",
      "instagram",
      "facebook",
      "map",
      "logo",
      "favicon",
      "banner",
      "description",
      "story",
      "team",
      "workshop",
    ]),
    value: str,
  }),
};
erp.post(["/:mod", "/:mod/:id"], async (req, res) => {
  const m = String(req.params.mod),
    id = req.params.id ? String(req.params.id) : undefined,
    u = res.locals.u;
  await db.$transaction(async (tx) => {
    let rid = id;
    if (m === "permissions") {
      if (u.role.name !== "Super Admin" || !id) fail(403, "Owner required");
      const role = await tx.role.findFirstOrThrow({
        where: { id, name: "Staff" },
      });
      const keys = z
        .array(z.enum(["services", "cars", "packages", "gallery"]))
        .parse(req.body.permissions);
      await tx.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            set: [],
            connectOrCreate: keys.map((key) => ({
              where: { key },
              create: { key },
            })),
          },
        },
      });
    } else if (m === "staff") {
      if (u.role.name !== "Super Admin") fail(403, "Super Admin required");
      const b = z
          .object({
            name: str,
            email,
            role: z.enum(["Manager", "Staff", "Admin"]),
            password: pw.optional(),
          })
          .parse(req.body),
        data = {
          name: b.name,
          email: b.email,
          role: { connect: { name: b.role } },
          ...(b.password
            ? {
                hash: await bcrypt.hash(b.password, 12),
                version: { increment: 1 },
              }
            : {}),
        };
      if (id) {
        const s = await tx.staff.findUniqueOrThrow({
          where: { id },
          include: { user: { include: { role: true } } },
        });
        if (s.user.role.name === "Super Admin")
          fail(403, "Protected owner account");
        await tx.user.update({ where: { id: s.userId }, data });
      } else {
        const s = await tx.user.create({
          data: {
            name: b.name,
            email: b.email,
            role: data.role,
            hash: await bcrypt.hash(pw.parse(b.password), 12),
            staff: { create: {} },
          },
        });
        rid = s.id;
      }
    } else if (m === "buy-enquiries" || m === "sell-requests") {
      if (!id) fail(400, "Request required");
      const e = await tx.enquiry.findUniqueOrThrow({ where: { id } }),
        b = z
          .object({
            status: z.enum(
              (e.kind === "Sell" ? sellStates : buyStates) as [
                string,
                ...string[],
              ],
            ),
            remarks: z.string().max(1000),
            internalNotes: z.string().max(2000),
            offer: num.optional(),
            staffId: str.optional(),
          })
          .parse(req.body);
      await tx.enquiry
        .update({
          where: { id, updatedAt: e.updatedAt },
          data: {
            status: b.status,
            remarks: b.remarks,
            staffId: b.staffId,
            internalNotes: b.internalNotes,
            history: [
              ...(e.history as any[]),
              { status: b.status, at: new Date().toISOString() },
            ],
            ...(e.kind === "Sell" && b.offer !== undefined
              ? { sell: { update: { offer: b.offer } } }
              : {}),
          },
          include: { customer: true },
        })
        .then(async (r) => {
          if (r.customer)
            await tx.notification.create({
              data: {
                userId: r.customer.userId,
                message: r.reference + " • " + r.status,
              },
            });
        });
    } else {
      const schema = schemas[m] || fail(405, "Action unavailable"),
        data: any = schema.parse(req.body);
      if (m === "cars")
        data.images = {
          ...(id ? { deleteMany: {} } : {}),
          create: data.images.map((url: string) => ({ url })),
        };
      const model = (tx as any)[mods[m]];
      const r = id
        ? await model.update({ where: { id }, data })
        : await model.create({ data });
      rid = r.id;
      if (m === "payments") {
        await tx.transaction.create({
          data: {
            paymentId: r.id,
            kind: r.status,
            amount: r.amount,
            description: r.reference,
          },
        });
        if (r.bookingId) {
          const b = await tx.booking.findUniqueOrThrow({
            where: { id: r.bookingId },
            include: { customer: true },
          });
          await tx.notification.create({
            data: {
              userId: b.customer.userId,
              message: r.reference + " • Payment " + r.status,
            },
          });
        }
      }
    }
    await tx.activityLog.create({
      data: {
        actor: u.id,
        action: (id ? "Updated " : "Created ") + m,
        recordId: rid!,
      },
    });
  });
  res.json({ message: "Saved." });
});
erp.delete("/:mod/:id", async (req, res) => {
  const m = String(req.params.mod);
  if (
    ![
      "cars",
      "services",
      "packages",
      "gallery",
      "reviews",
      "testimonials",
    ].includes(m)
  )
    fail(405, "Deletion unavailable");
  const model = (db as any)[mods[m]],
    where = { id: String(req.params.id) };
  await db.$transaction([
    ["cars", "services", "packages"].includes(m)
      ? model.update({ where, data: { deletedAt: new Date() } })
      : model.delete({ where }),
    db.activityLog.create({
      data: {
        actor: res.locals.u.id,
        action: "Deleted " + m,
        recordId: where.id,
      },
    }),
  ]);
  res.json({ message: "Removed." });
});
