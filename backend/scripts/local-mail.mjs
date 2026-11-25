// Local-only mailbox for testing recovery and verification. Never forward mail.
import { SMTPServer } from "smtp-server";
import fs from "node:fs/promises";
import crypto from "node:crypto";
await fs.mkdir(".local/mail", { recursive: true, mode: 0o700 });
new SMTPServer({
  disabledCommands: ["AUTH", "STARTTLS"],
  size: 100000,
  onData(stream, _session, done) {
    let bytes = "";
    stream.on("data", (chunk) => (bytes += chunk.toString()));
    stream.on("end", () =>
      fs
        .writeFile(".local/mail/" + crypto.randomUUID() + ".eml", bytes, {
          mode: 0o600,
        })
        .then(() => done(), done),
    );
  },
}).listen(2525, "127.0.0.1");
