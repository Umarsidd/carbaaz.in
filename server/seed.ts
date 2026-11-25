import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
try {
  for (const name of ["Super Admin", "Admin", "Manager", "Staff", "Customer"])
    await db.role.upsert({ where: { name }, create: { name }, update: {} });
  const titles = [
    "Car Wash",
    "Interior Detailing",
    "Exterior Detailing",
    "Ceramic Coating",
    "Graphene Coating",
    "PPF Installation",
    "Paint Correction",
    "AC Treatment",
    "Headlight Restoration",
    "Engine Bay Cleaning",
    "Rubbing & Polishing",
    "Complete Car Detailing",
  ];
  const desc = [
    "A meticulous hand wash for a clean, streak-free finish.",
    "A deep clean for leather, upholstery and every cabin surface.",
    "Restore the depth and clarity of your paintwork.",
    "A protective ceramic layer for lasting gloss.",
    "Advanced surface treatment for easier maintenance.",
    "Clear film to protect vulnerable painted panels.",
    "Precision polishing for light swirls and marks.",
    "Clean vents and refresh the cabin air.",
    "Restore clarity to weathered headlamp lenses.",
    "Careful cleaning of accessible engine bay surfaces.",
    "Refine the finish and bring back the shine.",
    "A comprehensive interior and exterior treatment.",
  ];
  for (const [i, name] of titles.entries()) {
    const slug = name.toLowerCase().replaceAll(" ", "-"),
      price = [
        599, 2499, 1999, 9999, 14999, 24999, 4999, 999, 1299, 799, 1999, 6999,
      ][i];
    await db.service.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        description: desc[i],
        image:
          "/media/" + ["wash", "interior", "paint", "hero"][i % 4] + ".webp",
        duration: i === 0 ? 60 : 120,
        benefits: [desc[i], "Includes a final finish inspection"],
        packages: {
          create: [
            { name: "Essential", price },
            { name: "Signature", price: price * 2 },
          ],
        },
      },
    });
  }
  if (process.env.DEMO_INVENTORY === "1")
    for (const [i, manufacturer, model] of [
      [0, "Porsche", "911 Carrera"],
      [1, "BMW", "3 Series"],
      [2, "Audi", "Q7"],
    ] as const) {
      let slug = manufacturer.toLowerCase() + "-demo";
      await db.vehicle.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          manufacturer,
          model,
          year: 2021 + i,
          price: [9800000, 3400000, 6500000][i],
          km: 21000 + i * 3500,
          fuel: "Petrol",
          transmission: "Automatic",
          ownership: "First owner",
          bodyType: ["Coupe", "Sedan", "SUV"][i],
          features: ["Climate control"],
          description: "Demonstration listing. Photograph is illustrative.",
          featured: true,
          images: {
            create: { url: "/media/" + ["hero", "bmw", "audi"][i] + ".webp" },
          },
        },
      });
    }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12)
      throw Error("Admin password needs 12 characters");
    await db.user.upsert({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
      update: {},
      create: {
        name: "CARBAAZ Admin",
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        hash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        verified: true,
        role: { connect: { name: "Super Admin" } },
        staff: { create: {} },
      },
    });
  }
} finally {
  await db.$disconnect();
}
