// src/index.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.MONGO_DB || 'surfari';
const PORT = process.env.PORT || 3000;

if (!TOKEN) { console.error('❌ DISCORD_TOKEN missing'); process.exit(1); }
if (!MONGO_URL) { console.error('❌ MONGO_URL missing'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // needed for nick/roles
  ],
});
client.commands = new Collection();

const ROOT = __dirname; // this file is in src/
const COMMANDS_DIR = path.join(ROOT, 'commands');
const EVENTS_DIR = path.join(ROOT, 'events');

function loadEvents(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const ev = require(path.join(dir, file));
    if (!ev?.name || typeof ev.execute !== 'function') {
      console.warn(`⚠️ Skipping event ${file} (missing name/execute)`);
      continue;
    }
    if (ev.once) client.once(ev.name, (...args) => ev.execute(...args, client));
    else client.on(ev.name, (...args) => ev.execute(...args, client));
    console.log(`✅ Event loaded: ${ev.name}`);
  }
}

function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      const files = fs.readdirSync(sub).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const cmd = require(path.join(sub, file));
        if (!cmd?.data?.name || typeof cmd.execute !== 'function') {
          console.warn(`⚠️ Skipping command ${entry.name}/${file}`);
          continue;
        }
        client.commands.set(cmd.data.name, cmd);
        console.log(`✅ Command loaded: ${cmd.data.name}`);
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const cmd = require(path.join(dir, entry.name));
      if (!cmd?.data?.name || typeof cmd.execute !== 'function') {
        console.warn(`⚠️ Skipping command ${entry.name}`);
        continue;
      }
      client.commands.set(cmd.data.name, cmd);
      console.log(`✅ Command loaded: ${cmd.data.name}`);
    }
  }
}

// Basic interaction handler (if you don't already have one in /events)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (e) {
    console.error(e);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Command error.' });
    } else {
      await interaction.reply({ content: 'Command error.', ephemeral: true });
    }
  }
});

(async () => {
  // Mongo
  const mongo = await MongoClient.connect(MONGO_URL);
  const db = mongo.db(DB_NAME);
  client.db = db;

  // Webhook server
  const createWebhookServer = require(path.join(ROOT, 'server.js'));
  const app = createWebhookServer({ client, db });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.listen(PORT, () => console.log(`🌐 Webhook listening on :${PORT}`));

  // Load everything
  loadEvents(EVENTS_DIR);
  loadCommands(COMMANDS_DIR);

  client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));
  await client.login(TOKEN);
})().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
