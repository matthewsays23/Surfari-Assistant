const { Events } = require('discord.js');

function emojiKey(emoji) {
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user, passedClient) {
    try {
      if (user?.bot) return;

      if (reaction?.partial) {
        try { await reaction.fetch(); } catch { return; }
      }

      const message = reaction?.message;
      if (!message?.guild) return;

      const client = passedClient || reaction.client;
      const store = client.reactionRoles;
      if (!store) return;

      const cfg = store.get(message.id);
      if (!cfg) return;

      const key = emojiKey(reaction.emoji);
      const hit = cfg.mappings.find(m => m.emojiKey === key);
      if (!hit) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      if (member.roles.cache.has(hit.roleId)) {
        await member.roles.remove(hit.roleId, 'Reaction role remove');
      }
    } catch (e) {
      console.error('messageReactionRemove error:', e);
    }
  },
};
