import "dotenv/config";
import fs from "node:fs/promises";
import Stripe from "stripe";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ) ||
  process.env.NODE_ENV === "production"
)
  throw Error("Local test database only");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = crypto.randomBytes(18).toString("hex"),
  base = "http://localhost:3000/api",
  adminMail = "ops-" + suffix + "@example.test",
  mobile = "9000000000";
async function call(p, { body, cookie, method, expect = 200 } = {}) {
  const r = await fetch(base + p, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const v = await r.json();
  assert.equal(r.status, expect, p + ": " + JSON.stringify(v).slice(0, 180));
  return v;
}
async function login(email) {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
try {
  await db.user.create({
    data: {
      email: adminMail,
      name: "Smoke operator",
      role: { connect: { name: "Super Admin" } },
      hash: await bcrypt.hash(password, 12),
      staff: { create: {} },
    },
  });
  const admin = await login(adminMail),
    people = [];
  for (let i = 0; i < 2; i++) {
    const email = "owner-" + i + "-" + suffix + "@example.test";
    await call("/auth/register", {
      body: { email, password, name: "Test owner" },
      expect: 201,
    });
    people.push(await login(email));
  }
  const [cookie, other] = people;
  if (process.env.SMTP_URL === "smtp://127.0.0.1:2525") {
    const address = "owner-1-" + suffix + "@example.test";
    async function token(purpose) {
      for (const f of await fs.readdir(".local/mail")) {
        const eml = (await fs.readFile(".local/mail/" + f, "utf8"))
          .replace(/=\r?\n/g, "")
          .replace(/=3D/g, "=");
        if (eml.includes(address)) {
          const match = eml.match(
            new RegExp("purpose=" + purpose + "&token=([a-f0-9]{64})"),
          );
          if (match) return match[1];
        }
      }
      throw Error("Local confirmation mail missing");
    }
    await call("/auth/token", {
      body: { token: await token("verify"), purpose: "verify" },
    });
    assert.ok((await call("/me", { cookie: other })).verified);
    await call("/auth/recover", { body: { email: address } });
    const reset = await token("reset");
    await call("/auth/token", {
      body: { purpose: "reset", token: reset, password },
    });
    await call("/auth/token", {
      expect: 400,
      body: { purpose: "reset", token: reset, password },
    });
    people[1] = await login(address);
    console.log(
      "Verified email confirmation, recovery and single-use reset links.",
    );
  }

  await call("/admin/customers", { cookie, expect: 403 });
  assert.ok(
    (await call("/admin/customers", { cookie: admin })).some((c) =>
      c.user.email.includes(String(suffix)),
    ),
  );
  const staffMail = "agent-" + suffix + "@example.test";
  await call("/admin/staff", {
    cookie: admin,
    body: { name: "Smoke staff", email: staffMail, role: "Staff", password },
  });
  const staffCookie = await login(staffMail);
  await call("/admin/customers", { cookie: staffCookie, expect: 403 });
  assert.deepEqual(await call("/admin/bookings", { cookie: staffCookie }), []);
  await call("/admin/cars", { cookie: staffCookie, expect: 403 });
  const upload = new FormData();
  upload.append(
    "image",
    new Blob([await fs.readFile("public/media/wash.webp")], {
      type: "image/webp",
    }),
    "vehicle.webp",
  );
  const uploadRes = await fetch(base + "/upload?scope=sell", {
    method: "POST",
    headers: { cookie },
    body: upload,
  });
  assert.equal(uploadRes.status, 200);
  const privatePhoto = (await uploadRes.json()).url;
  for (const [reader, status] of [
    [cookie, 200],
    [people[1], 404],
    [admin, 200],
  ])
    assert.equal(
      (
        await fetch("http://localhost:3000" + privatePhoto, {
          headers: { cookie: reader },
        })
      ).status,
      status,
    );
  console.log("Assigned staff access and private seller photos verified.");
  const { services, cars } = await call("/catalog");
  assert.equal(services.length >= 12, true);
  const s = services[0],
    day = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    slotPath = "/slots?service=" + s.id + "&date=" + day,
    slots = await call(slotPath),
    contact = { name: "Test owner", email: "owner@example.test", mobile },
    booking = {
      vehicle: {
        manufacturer: "Test",
        model: "Sedan",
        registration: "TEST1",
        type: "Sedan",
      },
      contact,
      packageId: s.packages[0].id,
      starts: slots[0],
    };
  const reserve = () =>
    fetch(base + "/bookings", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
  assert.deepEqual(
    (await Promise.all([reserve(), reserve()])).map((x) => x.status).sort(),
    [201, 409],
  );
  const [r] = (await call("/customer", { cookie })).bookings;
  await call("/bookings/" + r.id, {
    cookie: people[1],
    body: { status: "Cancelled" },
    method: "PATCH",
    expect: 404,
  });
  await call("/bookings/" + r.id, {
    cookie: admin,
    method: "PATCH",
    body: { status: "Confirmed" },
  });
  if (process.env.STRIPE_LOCAL_PORT) {
    const pay = await call("/checkout/" + r.id, { cookie, body: {} });
    assert.ok(pay.url.includes("/checkout/"));
    console.log("Local payment provider returned a hosted checkout URL.");
  }
  await call("/bookings/" + r.id, {
    cookie,
    method: "PATCH",
    body: { starts: slots.at(-1) },
  });
  await call("/bookings/" + r.id, {
    cookie,
    method: "PATCH",
    body: { status: "Cancelled" },
  });
  assert.ok((await call(slotPath)).includes(slots[0]));

  if (process.env.STRIPE_LOCAL_PORT) {
    const p = await db.payment.findUniqueOrThrow({
      where: { reference: "WEB-" + r.reference },
    });
    const event = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_local_" + suffix,
          payment_status: "paid",
          metadata: { reference: p.reference },
          currency: "inr",
          amount_total: p.amount * 100,
        },
      },
    });
    const header = Stripe.webhooks.generateTestHeaderString({
      payload: event,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    for (let i = 0; i < 2; i++) {
      const response = await fetch("http://localhost:3000/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": header,
        },
        body: event,
      });
      assert.equal(response.status, 200);
    }
    assert.equal(await db.transaction.count({ where: { paymentId: p.id } }), 1);
    console.log(
      "Signed local payment webhook replay recorded one transaction.",
    );
  }
  const vehicle = {
    manufacturer: "Smoke",
    model: "Example",
    slug: "smoke-" + suffix,
    year: 2022,
    price: 100000,
    km: 1200,
    fuel: "Petrol",
    transmission: "Manual",
    ownership: "First",
    bodyType: "Sedan",
    registration: "TEST1",
    features: [],
    description: "Synthetic test fixture",
    featured: false,
    sold: false,
    images: ["/media/hero.webp"],
  };
  await call("/admin/cars", { cookie: admin, body: vehicle });
  const c = (await call("/catalog")).cars.find((x) => x.slug === vehicle.slug);
  await call("/admin/cars/" + c.id, {
    cookie: admin,
    body: { ...vehicle, price: 90000 },
  });
  assert.equal(
    (await call("/catalog")).cars.find((x) => x.id === c.id).price,
    90000,
  );
  for (const kind of ["Buy", "Sell"]) {
    const e = await call("/enquiries", {
      cookie,
      body: {
        ...contact,
        kind,
        message: "Please contact me",
        ...(kind === "Buy"
          ? { vehicleId: c.id }
          : { details: vehicle, images: [privatePhoto] }),
      },
      expect: 201,
    });
    await call("/track", {
      body: { reference: e.reference, mobile: "9000000001" },
      expect: 404,
    });
    const tr = await call("/track", {
      body: { reference: e.reference, mobile },
    });
    assert.equal(tr.status, "Submitted");
    assert.ok(!("email" in tr));
    const rows = await call(
      "/admin/" + (kind === "Buy" ? "buy-enquiries" : "sell-requests"),
      { cookie: admin },
    );
    assert.ok(rows.some((x) => x.reference === e.reference));
  }
  await call("/admin/cars/" + c.id, { cookie: admin, method: "DELETE" });
  assert.ok(!(await call("/catalog")).cars.some((x) => x.id === c.id));
  const service = {
    name: "Sample service",
    slug: "sample-" + suffix,
    description: "Test service",
    duration: 60,
    benefits: [],
    active: true,
    image: "/media/wash.webp",
  };
  await call("/admin/services", { cookie: admin, body: service });
  const svc = (await call("/catalog")).services.find(
    (x) => x.slug === service.slug,
  );
  await call("/admin/services/" + svc.id, {
    cookie: admin,
    body: { ...service, name: "Updated service" },
  });
  await call("/admin/services/" + svc.id, { cookie: admin, method: "DELETE" });
  assert.ok(!(await call("/catalog")).services.some((x) => x.id === svc.id));
  assert.ok((await call("/admin/reports", { cookie: admin })).months.length);
  for (const format of ["pdf", "xlsx"]) {
    let resp = await fetch(base + "/admin/reports?format=" + format, {
      headers: { cookie: admin },
    });
    assert.equal(resp.status, 200);
    assert.ok((await resp.arrayBuffer()).byteLength > 100);
  }
  await call("/auth/logout", { cookie, body: {} });
  await call("/customer", { cookie, expect: 401 });
  console.log(
    "Passed: registration, login, roles, ownership, booking concurrency, confirmation, reschedule, cancellation, catalog CRUD, buy/sell, tracking, customer records, reports, exports, logout.",
  );
} finally {
  await db.user.updateMany({
    where: { email: adminMail },
    data: { hash: "disabled", version: { increment: 1 } },
  });
  await db.$disconnect();
}
