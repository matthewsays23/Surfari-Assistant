 // src/services/sync.js
// Node 18+ has global fetch. If you're on Node 16, install node-fetch and import it.

const ROLE_MAP = {
  // Your Discord server
  [process.env.GUILD_ID]: {
    // Your Roblox group id
    groupId: Number(process.env.ROBLOX_GROUP_ID),
    // Roblox role name -> Discord role ID
    byName: {
      Owner:     process.env.ROLE_ID_OWNER,
      Admin:     process.env.ROLE_ID_ADMIN,
      Moderator: process.env.ROLE_ID_MOD,
      Member:    process.env.ROLE_ID_MEMBER,
    },
    setNickname: true,
  },
};

async function getRobloxRoles(userId) {
  const r = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
  if (!r.ok) throw new Error(`Roblox roles fetch failed: ${r.status}`);
  const data = await r.json();
  return data.data || [];
}

async function getRobloxUsername(userId) {
  const r = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!r.ok) throw new Error(`Roblox username fetch failed: ${r.status}`);
  const data = await r.json();
  return data.name;
}

async function syncMember(guild, discordUserId, robloxUserId, robloxUsername) {
  const cfg = ROLE_MAP[guild.id];
  if (!cfg) return;

  const member = await guild.members.fetch(discordUserId);

  const groups = await getRobloxRoles(robloxUserId);
  const match = groups.find(g => g.group?.id === cfg.groupId);

  let targetRoleId = null;
  if (match) {
    const roleName = match.role?.name;
    targetRoleId = (roleName && cfg.byName[roleName]) ? cfg.byName[roleName] : cfg.byName.Member;
  }

  const mapped = new Set(Object.values(cfg.byName));
  const toRemove = member.roles.cache
    .filter(r => mapped.has(r.id) && r.id !== targetRoleId)
    .map(r => r.id);

  if (toRemove.length) await member.roles.remove(toRemove).catch(() => {});
  if (targetRoleId) await member.roles.add(targetRoleId).catch(() => {});

  if (cfg.setNickname) {
    const finalName = robloxUsername || await getRobloxUsername(robloxUserId);
    await member.setNickname(finalName).catch(() => {});
  }
}

module.exports = { syncMember };