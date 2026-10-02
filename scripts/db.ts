/**
 * Local Postgres without Docker.
 *
 * `embedded-postgres` ships the real PostgreSQL binaries and runs them as an
 * ordinary user process — no daemon, no admin install, no container. The data
 * directory lives in `.postgres/` inside the project and is gitignored.
 *
 *   pnpm db:start    start the server (idempotent)
 *   pnpm db:stop     stop it
 *   pnpm db:status   is it up?
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import net from "node:net";
import fs from "node:fs";

const DATA_DIR = path.resolve(process.cwd(), ".postgres", "data");
const PORT = Number(process.env.PGPORT ?? 5434);
const USER = "bella";
const PASSWORD = "bella";
const DATABASE = "bella_books";

function createServer(): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    // Keep the data between runs — this is a real database, not a fixture.
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
}

/** Is something already accepting connections on the port? */
function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function start() {
  if (await isPortOpen(PORT)) {
    console.log(`Postgres is already listening on ${PORT}.`);
    printUrl();
    return;
  }

  const pg = createServer();
  const initialised = fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));

  if (!initialised) {
    console.log("Creating the data directory (first run only)…");
    fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
    await pg.initialise();
  }

  console.log(`Starting Postgres on port ${PORT}…`);
  await pg.start();

  if (!initialised) {
    console.log(`Creating database "${DATABASE}"…`);
    await pg.createDatabase(DATABASE);
  }

  console.log("\nPostgres is up.");
  printUrl();
  console.log("\nIt keeps running in the background. Stop it with: pnpm db:stop");
}

async function stop() {
  if (!(await isPortOpen(PORT))) {
    console.log(`Nothing is listening on ${PORT}.`);
    return;
  }

  const pg = createServer();
  await pg.stop();
  console.log("Postgres stopped.");
}

async function status() {
  const up = await isPortOpen(PORT);
  console.log(up ? `Postgres is up on ${PORT}.` : `Postgres is not running on ${PORT}.`);
  if (up) printUrl();
  process.exitCode = up ? 0 : 1;
}

function printUrl() {
  console.log(
    `  DATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public"`,
  );
}

const command = process.argv[2];

const run =
  command === "stop" ? stop : command === "status" ? status : start;

run().catch((error: unknown) => {
  console.error("\nDatabase command failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
