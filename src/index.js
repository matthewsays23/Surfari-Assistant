const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionsBitField, 
  Permissions, 
  MessageManager, 
  Embed, 
  Collection 
} = require("discord.js");



const fs = require("fs");
require("dotenv").config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
}); 

client.commands = new Collection();

const functions = fs.readdirSync("./src/functions").filter(file => file.endsWith(".js"));
const eventFiles = fs.readdirSync("./src/events").filter(file => file.endsWith(".js"));
const commandFolders = fs.readdirSync("./src/commands");

(async () => {
  for (const file of functions) {
    require(`./functions/${file}`)(client);
  }

  client.handleEvents(eventFiles, "./src/events");
  client.handleCommands(commandFolders, "./src/commands");

  // ✅ Use DISCORD_TOKEN everywhere
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("❌ Discord token not found. Make sure DISCORD_TOKEN is set in your .env or Render environment variables.");
    process.exit(1);
  }

  client.login(token);

  
// after client.login(...)
const express = require("express");
const app = express();
app.use(express.json());

const webhookRouter = require("../bot/webhook")(client);
app.use("/webhook", webhookRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Bot webhook listening on ${port}`));


})();


