const { Events } = require('discord.js');

function emojiKey(emoji) {
  // custom → id, unicode → char/name
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user, passedClient) {
    try {
      if (user?.bot) return;

      if (reaction?.partial) {
        try { await reaction.fetch(); } catch (e) {
          console.warn('RR Add: failed to fetch partial reaction', e?.message);
          return;
        }
      }

      const message = reaction?.message;
      if (!message?.guild) return;

      const client = passedClient || reaction.client;
      const db = client?.db;
      if (!db) {
        console.warn('RR Add: db not ready');
        return;
      }

      // 🔍 Debug: confirm event is actually firing
      console.log('RR Add event', {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        userId: user.id,
        emoji: { id: reaction.emoji.id, name: reaction.emoji.name },
      });

      const coll = db.collection('reactionRoles');
      const cfg = await coll.findOne({
        guildId: message.guild.id,
        messageId: message.id,
      });

      if (!cfg) {
        console.log('RR Add: no config for this message');
        return;
      }

      const key = emojiKey(reaction.emoji);
      const hit = cfg.mappings.find(m => m.emojiKey === key);
      if (!hit) {
        console.log('RR Add: mapping not found for emoji', key, 'in', cfg.mappings);
        return;
      }

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        console.log('RR Add: member not found');
        return;
      }

      if (!member.roles.cache.has(hit.roleId)) {
        console.log('RR Add: adding role', hit.roleId, 'to', member.id);
        await member.roles.add(hit.roleId, 'Reaction role add');
      } else {
        console.log('RR Add: member already has role', hit.roleId);
      }
    } catch (e) {
      console.error('messageReactionAdd error:', e);
    }
  },
};
