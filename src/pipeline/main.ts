import { loadConfig } from "../lib/config";
import { getDb, closeDb } from "../db";
import { logger } from "../lib/logger";
import { runPipeline } from "./run";

async function main() {
  const config = loadConfig();
  const db = getDb(config.DATABASE_URL);

  try {
    await runPipeline(db, config);
  } catch (err) {
    logger.error({ err }, "Fatal pipeline error");
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("Unhandled pipeline error:", err);
  process.exitCode = 1;
});
