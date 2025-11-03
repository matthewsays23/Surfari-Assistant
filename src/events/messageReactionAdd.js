const { Events } = require('discord.js');

function emojiKey(emoji) {
  // custom → id, unicode → char/name
  return emoji?.id ? emoji.id : emoji?.name || null;
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user /* client is ignored now */) {
    try {
      if (user?.bot) return;

      if (reaction?.partial) {
        try { await reaction.fetch(); } catch (e) {
          console.warn('RR ADD: failed to fetch partial reaction', e?.message);
          return;
        }
      }

      const message = reaction?.message;
      if (!message?.guild) return;

      const db = global._surfariDb;
      if (!db) {
        console.warn('RR ADD: global db not ready');
        return;
      }

      const coll = db.collection('reactionRoles');

      // Debug: confirm the event is firing
      console.log('RR ADD fired', {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        userId: user.id,
        emoji: { id: reaction.emoji.id, name: reaction.emoji.name },
      });

      const cfg = await coll.findOne({
        guildId: message.guild.id,
        messageId: message.id,
      });

      if (!cfg) {
        console.log('RR ADD: no config for this message');
        return;
      }

      const key = emojiKey(reaction.emoji);
      console.log('RR ADD: using key', key, 'mappings:', cfg.mappings);

      const hit = cfg.mappings.find(m => m.emojiKey === key);
      if (!hit) {
        console.log('RR ADD: no mapping for emoji key', key);
        return;
      }

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        console.log('RR ADD: member not found');
        return;
      }

      if (!member.roles.cache.has(hit.roleId)) {
        console.log('RR ADD: adding role', hit.roleId, 'to', member.id);
        await member.roles.add(hit.roleId, 'Reaction role add');
      } else {
        console.log('RR ADD: member already has role', hit.roleId);
      }
    } catch (e) {
      console.error('messageReactionAdd error:', e);
    }
  },
};

