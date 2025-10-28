// src/server.js
const express = require('express');
const crypto  = require('crypto');

module.exports = function createWebhookServer({ client, db }) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // ---- ENV ----
  const STATE_SECRET       = process.env.STATE_SECRET;
  const WEBHOOK_SECRET     = process.env.SURFARI_WEBHOOK_SECRET;   // optional but recommended
  const GUILD_ID           = process.env.GUILD_ID;
  const VERIFIED_ROLE_ID   = process.env.VERIFIED_ROLE_ID;
  const SURFARI_GROUP_ID   = String(process.env.SURFARI_GROUP_ID || '');
  const ROLE_MAP           = JSON.parse(process.env.ROLE_MAP_JSON || '{}'); // e.g. {"255":"<OwnerRoleID>","200":"<AdminRoleID>","0":"<MemberRoleID>"} or {"Lifeguard":"<id>"}

  if (!GUILD_ID) console.warn("[server] GUILD_ID not set; state fallback requires it");
  if (!STATE_SECRET) console.warn("[server] STATE_SECRET not set; state cannot be verified");
  console.log("[server] Role map keys:", Object.keys(ROLE_MAP));

  // ---- helpers ----
  function safeHmacBase64(secret, payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64');
  }

  function safeHmacBase64Url(secret, payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  }

  function verifyOptionalWebhookSignature(rawBody, givenB64) {
    if (!WEBHOOK_SECRET) return true;              // not enforced
    if (!givenB64) return false;
    const calc = safeHmacBase64(WEBHOOK_SECRET, rawBody);
    // timingSafeEqual throws if lengths differ; guard first:
    if (calc.length !== givenB64.length) return false;
    return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(givenB64));
  }

  /**
   * Accept BOTH state formats:
   *  A) NEW: "<payloadB64url>.<sigB64url>", payload = { d, g, t, v }
   *  B) OLD: "<hashHex>.<discordId>.<tsMs>", where hashHex = HMAC( `${discordId}.${ts}` ) in hex
   * Returns: { d, g?, t?, v }
   */
  function parseAndValidateStateFlexible(state) {
    if (!state || !STATE_SECRET) throw new Error('state missing');
    const parts = String(state).split('.');

    // NEW format
    if (parts.length === 2) {
      const [payloadB64, sigB64] = parts;
      const calc = safeHmacBase64Url(STATE_SECRET, payloadB64);
      if (sigB64 !== calc) throw new Error('bad state signature');
      let obj;
      try {
        obj = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      } catch {
        throw new Error('invalid state payload');
      }
      if (!obj?.d) throw new Error('invalid state (no discord id)');
      if (obj?.t && Date.now() > obj.t) throw new Error('state expired');
      return { d: obj.d, g: obj.g, t: obj.t, v: obj.v ?? 2 };
    }

    // OLD format
    if (parts.length === 3) {
      const [hashHex, discordId, tsStr] = parts;
      const body = `${discordId}.${tsStr}`;
      const calcHex = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('hex');
      if (hashHex !== calcHex) throw new Error('bad state signature');
      const ts = Number(tsStr);
      if (Number.isFinite(ts) && Date.now() - ts > 10 * 60 * 1000) throw new Error('state expired');
      return { d: discordId, t: ts, v: 1 }; // no g in v1; we'll fallback to env GUILD_ID
    }

    throw new Error('invalid state format');
  }

  function pickDiscordRoleIdForMapping(roleRankOrName) {
    // Accept numeric rank (stringified) or roleName
    const key = String(roleRankOrName);
    return ROLE_MAP[key] || null;
  }

  app.post('/api/discord/verify', async (req, res) => {
    try {
      if (!STATE_SECRET) throw new Error('STATE_SECRET not set');
      if (!GUILD_ID) throw new Error('GUILD_ID not set');

      // Optional HMAC from website
      const raw = JSON.stringify(req.body || {});
      const given = req.get('x-surfari-signature') || '';
      if (!verifyOptionalWebhookSignature(raw, given)) {
        return res.status(401).json({ error: 'bad signature' });
      }

      const { state, robloxId, username, displayName, roles } = req.body || {};
      if (!state || !robloxId || !username) return res.status(400).json({ error: 'missing fields' });

      // Accept both state formats; allow env fallback for guild
      const st = parseAndValidateStateFlexible(state); // may not include g if old format
      const guildId = st.g || GUILD_ID;

      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(st.d);

      // ----- persist link -----
      await db.collection('links').updateOne(
        { discordId: st.d, guildId },
        {
          $set: {
            discordId: st.d,
            guildId,
            robloxId: String(robloxId),
            username,
            displayName: displayName || username,
            linkedAt: new Date(),
            lastSyncAt: new Date(),
          },
        },
        { upsert: true }
      );

      // ----- nickname -----
      const nick = (displayName || username || '').slice(0, 32);
      try { if (nick) await member.setNickname(nick, 'Surfari verification'); } catch { /* ignore (permissions/role order) */ }

      // ----- role mapping -----
      // Expect roles from website like: [{ groupId, roleId, roleName }]
      const toAdd = new Set();
      if (VERIFIED_ROLE_ID) toAdd.add(VERIFIED_ROLE_ID);

      const surfariRoles = Array.isArray(roles)
        ? roles.filter(r => String(r.groupId) === SURFARI_GROUP_ID)
        : [];

      for (const r of surfariRoles) {
        // We allow mapping by rank (roleId from payload carries rank) OR by name
        const mapped =
          pickDiscordRoleIdForMapping(String(r.roleId)) ||
          pickDiscordRoleIdForMapping(r.roleName);
        if (mapped) toAdd.add(mapped);
      }

      // Optional: remove prior Surfari-mapped roles first (prevents multiple rank roles)
      const mappedRoleIds = Object.values(ROLE_MAP);
      const rolesToRemove = member.roles.cache.filter(r => mappedRoleIds.includes(r.id));
      if (rolesToRemove.size) {
        await member.roles.remove(rolesToRemove, 'Surfari rank remap');
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
