// @ts-types="npm:@types/pg@8.15.6"
import { Client } from "pg";

const CHANNEL = "sdx_catalogue_changed";
const RETRY_MS = 5_000;

export async function listenForCatalogChanges(
  connectionString: string,
  onConnectionChange: (connected: boolean) => void,
  onCatalogChange: () => void,
): Promise<never> {
  for (;;) {
    let client: Client | undefined;
    try {
      client = new Client({
        connectionString,
        connectionTimeoutMillis: RETRY_MS,
        query_timeout: RETRY_MS,
        keepAlive: true,
        application_name: "sdx-brochure-catalogue",
      });
      const connection = client;
      const disconnected = new Promise<void>((resolve) => {
        connection.on("error", () => resolve());
        connection.once("end", resolve);
      });
      client.on("notification", ({ channel }) => {
        if (channel === CHANNEL) onCatalogChange();
      });

      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      onConnectionChange(true);
      await disconnected;
    } catch {
      console.warn("Could not subscribe to Portal catalogue changes");
    } finally {
      onConnectionChange(false);
      await client?.end().catch(() => {});
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}
