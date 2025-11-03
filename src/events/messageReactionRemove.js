const { Events } = require('discord.js');

function emojiKeyFromReactionEmoji(emoji) {
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user, client) {
    try {
      if (user.bot) return;

      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      const { message } = reaction;
      if (!message?.guild) return;

      const key = emojiKeyFromReactionEmoji(reaction.emoji);
      if (!key) return;

      const coll = client.db.collection('reactionRoles');
      const cfg  = await coll.findOne({ guildId: message.guild.id, messageId: message.id });
      if (!cfg) return;

      const hit  = cfg.mappings.find(m => m.emojiKey === key);
      if (!hit) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      if (member.roles.cache.has(hit.roleId)) {
        await member.roles.remove(hit.roleId, 'Reaction role remove');
      }
    } catch (e) {
      console.error('messageReactionRemove error:', e);
    }
  }
};
