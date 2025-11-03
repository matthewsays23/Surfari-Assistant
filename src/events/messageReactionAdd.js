const { Events } = require('discord.js');

function emojiKey(emoji) {
  // custom => id, unicode => name/char
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user, passedClient) {
    try {
      if (user?.bot) return;

      // Handle partials
      if (reaction?.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      const message = reaction?.message;
      if (!message?.guild) return;

      // Get DB safely (passed client OR reaction.client)
      const client = passedClient || reaction.client;
      const db = client?.db;
      if (!db) {
        // optional: uncomment to debug
        // console.warn('reactionAdd: db not ready', { hasPassedClient: !!passedClient, hasReactionClient: !!reaction?.client });
        return;
      }

      const coll = db.collection('reactionRoles');

      // Find config for this message
      const cfg = await coll.findOne({ guildId: message.guild.id, messageId: message.id });
      if (!cfg) return;

      // Map emoji to role
      const key = emojiKey(reaction.emoji);
      if (!key) return;

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
  }
};
