const { Events } = require('discord.js');

function emojiKey(emoji) {
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionAdd,
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
      if (!store) {
        // no configs bound yet
        return;
      }

      const cfg = store.get(message.id);
      if (!cfg) {
        // no reaction-roles for this message
        return;
      }

      const key = emojiKey(reaction.emoji);
      const hit = cfg.mappings.find(m => m.emojiKey === key);
      if (!hit) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      if (!member.roles.cache.has(hit.roleId)) {
        await member.roles.add(hit.roleId, 'Reaction role add');
      }
    } catch (e) {
      console.error('messageReactionAdd error:', e);
    }
  },
};
