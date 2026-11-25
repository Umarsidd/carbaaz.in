import net from "node:net";
import fs from "node:fs";

export async function ensureLocalDb() {
  if (process.env.NODE_ENV === "production") return;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    return;
  }
  if (url.hostname !== "127.0.0.1") return;
  const port = Number(url.port || 5432);

  const isOpen = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });

  if (isOpen) return;

  console.log(`[CARBAAZ] Starting embedded local PostgreSQL on port ${port}...`);
  try {
    const { default: Pg } = await import("embedded-postgres");
    const dir = ".local/pg";
    const pg = new Pg({
      databaseDir: dir,
      user: url.username,
      password: url.password,
      port,
      persistent: true,
    });
    if (!fs.existsSync(dir + "/PG_VERSION")) await pg.initialise();
    await pg.start();
    const client = pg.getPgClient();
    await client.connect();
    if (
      !(await client.query("SELECT 1 FROM pg_database WHERE datname='carbaaz'"))
        .rowCount
    ) {
      await pg.createDatabase("carbaaz");
    }
    await client.end();
    console.log(`[CARBAAZ] Embedded PostgreSQL started successfully.`);
    process.on("SIGTERM", async () => {
      await pg.stop();
    });
  } catch (err: any) {
    console.warn(`[CARBAAZ] Could not start embedded PostgreSQL:`, err.message);
  }
}
