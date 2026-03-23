import PgBoss from "pg-boss";
import { pool } from "./db";
import { handleContactsSync } from "./jobs/contacts-sync";
import { handleVipClassifier } from "./jobs/vip-classifier";
import { handleChiefOfStaff } from "./jobs/chief-of-staff";
import { handleHealthCheck } from "./jobs/health-check";
import { scheduleTenantsJobs } from "./jobs/scheduler";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

async function main() {
  console.log("Starting worker...");

  const boss = new PgBoss({
    connectionString: DATABASE_URL,
    retryLimit: 3,
    retryDelay: 1000,
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 60 * 60 * 24, // 24 hours
    deleteAfterDays: 7,
  });

  // Handle errors
  boss.on("error", (error) => {
    console.error("pg-boss error:", error);
  });

  // Start the boss
  await boss.start();
  console.log("pg-boss started");

  // Register job handlers
  await boss.work("contacts-sync", { teamSize: 2, teamConcurrency: 1 }, handleContactsSync);
  await boss.work("vip-classifier", { teamSize: 1, teamConcurrency: 1 }, handleVipClassifier);
  await boss.work("chief-of-staff", { teamSize: 1, teamConcurrency: 1 }, handleChiefOfStaff);
  await boss.work("health-check", { teamSize: 5, teamConcurrency: 1 }, handleHealthCheck);

  console.log("Job handlers registered");

  // Schedule tenant jobs
  await scheduleTenantsJobs(boss);
  console.log("Tenant jobs scheduled");

  // Keep the process alive
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await boss.stop();
    await pool.end();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await boss.stop();
    await pool.end();
    process.exit(0);
  });

  console.log("Worker is running. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
