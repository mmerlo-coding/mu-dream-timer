import { Client, GatewayIntentBits } from "discord.js";
import { registerInteractionHandlers } from "./handlers/interactions.js";
import { bootstrapDashboard } from "./services/bootstrap.js";
import { startNotificationScheduler } from "./services/notifier.js";
import { startDashboardRefreshScheduler } from "./services/panel-updater.js";

export function createBot() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  registerInteractionHandlers(client);

  client.once("ready", async () => {
    console.log(`Logged in as ${client.user?.tag}`);

    await bootstrapDashboard(client);
    startNotificationScheduler(client);
    startDashboardRefreshScheduler(client);
  });

  return client;
}
