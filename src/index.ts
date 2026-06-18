import "dotenv/config";
import { createBot } from "./bot.js";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is required. Copy .env.example to .env and fill it in.");
}

const bot = createBot();
bot.login(token);
