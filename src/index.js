// src/index.js
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');               // <-- missing in your file
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Optional: surface hidden crashes
process.on('unhandledRejection', (r) => console.error('UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));

const TOKEN     = process.env.DISCORD_TOKEN;
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME   = process.env.MONGO_DB || 'surfari';
const PORT      = process.env.PORT || 3000;

if (!TOKEN)     { console.error('❌ DISCORD_TOKEN missing');  process.exit(1); }
if (!MONGO_URL) { console.error('❌ MONGO_URL missing');      process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // needed for nick/roles
  ],
});
client.commands = new Collection();

const ROOT         = __dirname; // this file is in src/
const COMMANDS_DIR = path.join(ROOT, 'commands');
const EVENTS_DIR   = path.join(ROOT, 'events');

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

async function registerGuildCommands() {
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID; // Application ID
  const GUILD_ID  = process.env.GUILD_ID;          // target server
  if (!CLIENT_ID || !GUILD_ID) {
    console.error('❌ Missing DISCORD_CLIENT_ID or GUILD_ID for command registration');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = [...client.commands.values()].map(c => c.data.toJSON());
  console.log(`📝 Registering ${body.length} guild commands to ${GUILD_ID}...`);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log('✅ Guild commands registered.');
}

(async () => {
  // --- Mongo ---
  console.log('📦 Connecting to Mongo…');
  const mongo = await MongoClient.connect(MONGO_URL);
  const db = mongo.db(DB_NAME);
  client.db = db;
  console.log('✅ Mongo connected. DB:', DB_NAME);

  // --- Webhook server (Express app exported from src/server.js) ---
  const createWebhookServer = require(path.join(ROOT, 'server.js'));
  const app = createWebhookServer({ client, db });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.listen(PORT, () => console.log(`🌐 Webhook listening on :${PORT}`));

  // --- Load events/commands ---
  loadEvents(EVENTS_DIR);
  loadCommands(COMMANDS_DIR);

  // --- Discord login & register commands ---
  client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    try {
      await registerGuildCommands();
    } catch (e) {
      console.error('Command registration failed:', e);
    }
  });

  await client.login(TOKEN);        // <-- this was missing
})().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
