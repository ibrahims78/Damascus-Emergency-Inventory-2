import app from "./app";
import { logger } from "./lib/logger";
import { databaseReady } from "@workspace/db";
import { ensureNodeIdentity } from "./lib/sync-service";
import { startBackupScheduler } from "./lib/backup-scheduler";

export async function startServer(port: number): Promise<ReturnType<typeof app.listen>> {
  await databaseReady;
  await ensureNodeIdentity("web");
  startBackupScheduler();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }

      logger.info({ port }, "Server listening");
      resolve(server);
    });

    server.once("error", reject);
  });
}