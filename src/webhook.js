// src/webhook.js
const express = require("express");
const crypto = require("crypto");
const { syncMember } = require("./services/sync");

module.exports = (client) => {
  const app = express();
  app.use(express.json());

  app.post("/webhook/syncMember", async (req, res) => {
    try {
      const sig = req.header("X-Surfari-Signature") || "";
      const calc = crypto.createHmac("sha256", process.env.BOT_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body || {})).digest("hex");
      if (sig !== calc) return res.status(401).json({ error: "Bad signature" });

      const { guildId, discordId, robloxUserId, robloxUsername } = req.body;
      if (!guildId || !discordId || !robloxUserId) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const guild = await client.guilds.fetch(guildId);
      await syncMember(guild, discordId, robloxUserId, robloxUsername);

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`🌐 Bot webhook listening on ${port}`));
};
