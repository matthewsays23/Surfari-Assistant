
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

function verifySig(secret) {
  return (req, res, next) => {
    const sig = req.header("X-Surfari-Signature") || "";
    const body = JSON.stringify(req.body || {});
    const calc = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (sig !== calc) return res.status(401).json({ error: "Bad signature" });
    next();
  };
}

module.exports = (client) => {
  const secret = process.env.BOT_WEBHOOK_SECRET;
  router.post("/syncMember", verifySig(secret), async (req, res) => {
    try {
      const { guildId, discordId } = req.body;
      const guild = await client.guilds.fetch(guildId);
      const { syncMember } = require("../src/services/sync"); // we’ll add next
      await syncMember(guild, discordId);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  return router;
};
