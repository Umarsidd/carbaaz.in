import "dotenv/config";
import Pg from "embedded-postgres";
import fs from "node:fs";
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1") throw Error("Local databases only");
const dir = ".local/pg",
  pg = new Pg({
    databaseDir: dir,
    user: url.username,
    password: url.password,
    port: Number(url.port),
    persistent: true,
  });
if (!fs.existsSync(dir + "/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname='carbaaz'"))
    .rowCount
)
  await pg.createDatabase("carbaaz");
await client.end();
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit();
});
setInterval(() => {}, 60000);
