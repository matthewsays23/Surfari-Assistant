// src/commands/Community/reaction-roles.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function parseEmojiKey(emojiTextOrObj) {
  // custom emoji -> id, unicode -> char/name
  if (emojiTextOrObj && typeof emojiTextOrObj === 'object') {
    return emojiTextOrObj.id ? emojiTextOrObj.id : emojiTextOrObj.name || null;
  }
  const s = String(emojiTextOrObj).trim();
  const m = s.match(/^<a?:\w+:(\d+)>$/);
  return m ? m[1] : s;
}
function isCustomEmojiString(s) {
  return /^<a?:\w+:(\d+)>$/.test(String(s).trim());
}
function extractCustomId(s) {
  const m = String(s).trim().match(/^<a?:\w+:(\d+)>$/);
  return m ? m[1] : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rr')
    .setDescription('Reaction roles (bind to an existing message)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('bind')
        .setDescription('Bind reaction roles to an existing message')
        .addChannelOption(o => o.setName('channel').setDescription('Channel of the message').setRequired(true))
        .addStringOption(o => o.setName('message_id').setDescription('Target message ID').setRequired(true))
        .addStringOption(o =>
          o.setName('mappings')
            .setDescription('One per line: EMOJI = @Role (or RoleID)')
            .setRequired(true)
        )
        .addBooleanOption(o =>
          o.setName('clear')
            .setDescription('Clear all reactions on the message before binding (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete reaction-roles config by message ID')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = interaction.client.db;
    const coll = db.collection('reactionRoles');

    if (sub === 'bind') {
      const channel   = interaction.options.getChannel('channel', true);
      const messageId = interaction.options.getString('message_id', true);
      const text      = interaction.options.getString('mappings', true);
      const doClear   = interaction.options.getBoolean('clear') || false;

      const me = await interaction.guild.members.fetchMe();
      const need = ['ViewChannel','ReadMessageHistory','AddReactions','SendMessages'];
      const missing = need.filter(p => !channel.permissionsFor(me)?.has(p));
      if (missing.length) {
        return interaction.reply({ ephemeral: true, content: `I’m missing permissions in ${channel}: **${missing.join(', ')}**` });
      }
      if (!me.permissions.has('ManageRoles')) {
        return interaction.reply({ ephemeral: true, content: 'I need the **Manage Roles** permission.' });
      }

      await interaction.deferReply({ ephemeral: true });

      // Fetch the existing message
      let msg;
      try {
        msg = await channel.messages.fetch(messageId);
      } catch {
        return interaction.editReply(`❌ I can’t fetch message \`${messageId}\` in ${channel}. Make sure the ID is correct and I can read history.`);
      }

      // Parse mappings
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];
      const errors = [];

      for (const line of lines) {
        const parts = line.split('=');
        if (parts.length !== 2) { errors.push(`Bad line: "${line}"`); continue; }

        const emojiRaw = parts[0].trim();
        const roleRaw  = parts[1].trim();

        // Resolve role by mention/id/name
        let roleId = roleRaw.replace(/[<@&>]/g, '');
        if (!/^\d{5,}$/.test(roleId)) {
          const byName = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleRaw.toLowerCase());
          if (!byName) { errors.push(`Role not found: "${roleRaw}"`); continue; }
          roleId = byName.id;
        }
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) { errors.push(`Invalid role: ${roleId}`); continue; }
        if (role.position >= me.roles.highest.position) {
          errors.push(`Can’t assign **${role.name}** (it’s >= my top role).`);
          continue;
        }

        let emojiForMessage = emojiRaw;
        let emojiKey        = emojiRaw;
        if (isCustomEmojiString(emojiRaw)) {
          const id = extractCustomId(emojiRaw);
          emojiKey = id;       // store custom by ID
        } else {
          emojiKey = emojiRaw; // unicode store raw
        }

        parsed.push({ emojiForMessage, emojiKey, roleId });
      }

      if (!parsed.length) {
        return interaction.editReply(`❌ No valid mappings.\n${errors.join('\n') || ''}`);
      }

      // optional: clear reactions first
      if (doClear) {
        try { await msg.reactions.removeAll(); } catch {}
      }

      // React with each emoji on the existing message
      for (const p of parsed) {
        try {
          await msg.react(p.emojiForMessage);
        } catch (e) {
          errors.push(`Failed to react ${p.emojiForMessage}: ${e.message}`);
        }
      }

      // Save config
      await coll.updateOne(
        { guildId: interaction.guild.id, messageId: msg.id },
        {
          $set: {
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: msg.id,
            mappings: parsed.map(p => ({ emojiKey: p.emojiKey, roleId: p.roleId })),
            createdBy: interaction.user.id,
            createdAt: new Date(),
          }
        },
        { upsert: true }
      );

      return interaction.editReply(
        `✅ Bound reaction roles to message \`${msg.id}\` in ${channel}.\n` +
        (errors.length ? `\nWarnings:\n${errors.join('\n')}` : '')
      );
    }

    if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id', true);
      const doc = await coll.findOne({ guildId: interaction.guild.id, messageId });
      if (!doc) return interaction.reply({ ephemeral: true, content: 'No config found for that message.' });

      await coll.deleteOne({ guildId: interaction.guild.id, messageId });
      return interaction.reply({ ephemeral: true, content: '🗑️ Deleted reaction-roles config (message left untouched).' });
    }
  }
};
