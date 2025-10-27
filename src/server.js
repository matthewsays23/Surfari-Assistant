// src/server.js
const express = require('express');
const crypto = require('crypto');

module.exports = function createWebhookServer({ client, db }) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const STATE_SECRET = process.env.STATE_SECRET;
  const WEBHOOK_SECRET = process.env.SURFARI_WEBHOOK_SECRET; // optional but recommended
  const GUILD_ID = process.env.GUILD_ID;
  const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
  const SURFARI_GROUP_ID = String(process.env.SURFARI_GROUP_ID || '');
  const ROLE_MAP = JSON.parse(process.env.ROLE_MAP_JSON || '{}'); // {"Lifeguard":"<discordRoleId>", "Surfer":"<discordRoleId>"} or {"7654321":"<discordRoleId>"}

  function parseAndValidateState(state) {
    const [payload, sig] = String(state).split('.');
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
    if (sig !== expected) throw new Error('bad state signature');
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!obj?.d || !obj?.g || !obj?.t) throw new Error('invalid state');
    if (Date.now() > obj.t) throw new Error('state expired');
    return obj; // { d: discordUserId, g: guildId, t, v }
  }

  app.post('/api/discord/verify', async (req, res) => {
    try {
      if (!STATE_SECRET) throw new Error('STATE_SECRET not set');
      if (!GUILD_ID) throw new Error('GUILD_ID not set');

      // Optional HMAC from website
      if (WEBHOOK_SECRET) {
        const raw = JSON.stringify(req.body || {});
        const given = req.get('x-surfari-signature') || '';
        const calc = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('base64');
        if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(given))) {
          return res.status(401).json({ error: 'bad signature' });
        }
      }

      const { state, robloxId, username, displayName, roles } = req.body || {};
      if (!state || !robloxId || !username) return res.status(400).json({ error: 'missing fields' });

      const st = parseAndValidateState(state);
      if (st.g !== GUILD_ID) return res.status(400).json({ error: 'wrong guild' });

      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(st.d);

      // 1) save link
      await db.collection('links').updateOne(
        { discordId: st.d },
        { $set: { discordId: st.d, robloxId: String(robloxId), username, displayName, linkedAt: new Date() } },
        { upsert: true }
      );

      // 2) nickname
      const nick = (displayName || username).slice(0, 32);
      try { await member.setNickname(nick, 'Surfari verification'); } catch { /* missing perms or role order */ }

      // 3) roles
      const toAdd = new Set();
      if (VERIFIED_ROLE_ID) toAdd.add(VERIFIED_ROLE_ID);

      const surfariRoles = Array.isArray(roles) ? roles.filter(r => String(r.groupId) === SURFARI_GROUP_ID) : [];
      for (const r of surfariRoles) {
        const mapped = ROLE_MAP[String(r.roleId)] || ROLE_MAP[r.roleName];
        if (mapped) toAdd.add(mapped);
      }
      const addList = [...toAdd].filter(id => !member.roles.cache.has(id));
      if (addList.length) await member.roles.add(addList, 'Surfari role sync');

      return res.json({ ok: true, discordId: st.d, appliedRoles: [...toAdd] });
    } catch (e) {
      console.error('/api/discord/verify', e);
      return res.status(400).json({ error: e.message || 'error' });
    }
  });

  return app;
};
