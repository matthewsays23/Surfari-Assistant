// src/commands/Community/reaction-roles.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function parseEmojiKey(emojiTextOrObj) {
  // Accepts unicode, custom reaction object, or string like "<:name:123>" / "<a:name:123>"
  if (emojiTextOrObj && typeof emojiTextOrObj === 'object') {
    if (emojiTextOrObj.id) return emojiTextOrObj.id;     // custom emoji id
    if (emojiTextOrObj.name) return emojiTextOrObj.name; // unicode
  }
  const s = String(emojiTextOrObj).trim();
  const m = s.match(/^<a?:\w+:(\d+)>$/); // custom emoji ID
  return m ? m[1] : s; // unicode char or raw
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
    .setDescription('Reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a reaction-roles message')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Embed description').setRequired(true))
        .addStringOption(o =>
          o.setName('mappings')
           .setDescription('One per line: EMOJI = @Role (or RoleID)')
           .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a reaction-roles config by message ID')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = interaction.client.db;
    const coll = db.collection('reactionRoles');

    if (sub === 'create') {
      const channel      = interaction.options.getChannel('channel', true);
      const title        = interaction.options.getString('title', true);
      const description  = interaction.options.getString('description', true);
      const mappingsText = interaction.options.getString('mappings', true);

      const me = await interaction.guild.members.fetchMe();
      const need = ['ManageRoles', 'SendMessages', 'AddReactions', 'ReadMessageHistory', 'ViewChannel'];
      const missing = need.filter(p => !channel.permissionsFor(me).has(p));
      if (missing.length) {
        return interaction.reply({ ephemeral: true, content: `I’m missing permissions in ${channel}: **${missing.join(', ')}**` });
      }
      if (!me.permissions.has('ManageRoles')) {
        return interaction.reply({ ephemeral: true, content: 'I need the **Manage Roles** permission.' });
      }

      const lines  = mappingsText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];
      const errors = [];

      for (const line of lines) {
        const parts = line.split('=');
        if (parts.length !== 2) { errors.push(`Bad line: "${line}"`); continue; }

        const emojiRaw = parts[0].trim();
        const roleRaw  = parts[1].trim();

        // Resolve role by mention, id, or name
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

        let emojiForMessage = emojiRaw;           // what we react with
        let emojiKey        = emojiRaw;           // how we store/compare
        if (isCustomEmojiString(emojiRaw)) {
          const id = extractCustomId(emojiRaw);
          emojiKey = id; // store custom by ID
        } else {
          // unicode stays as-is
          emojiKey = emojiRaw;
        }

        parsed.push({ emojiForMessage, emojiKey, roleId });
      }

      if (!parsed.length) {
        return interaction.reply({ ephemeral: true, content: `No valid mappings.\n${errors.join('\n') || ''}` });
      }

      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          `${description}\n\n` +
          parsed.map(p => `${p.emojiForMessage} → <@&${p.roleId}>`).join('\n')
        )
        .setColor(0xF97316); // Surfari orange

      const msg = await channel.send({ embeds: [embed] });

      // add reactions
      for (const p of parsed) {
        try { await msg.react(p.emojiForMessage); }
        catch (e) { errors.push(`Failed to react ${p.emojiForMessage}: ${e.message}`); }
      }

      // save config
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

      return interaction.editReply({
        content: `✅ Reaction roles created in ${channel}. Message ID: \`${msg.id}\`${errors.length ? `\n\nWarnings:\n${errors.join('\n')}` : ''}`
      });
    }

    if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id', true);
      const doc = await coll.findOne({ guildId: interaction.guild.id, messageId });
      if (!doc) return interaction.reply({ ephemeral: true, content: 'No config found for that message.' });

      await coll.deleteOne({ guildId: interaction.guild.id, messageId });
      try {
        const ch  = await interaction.client.channels.fetch(doc.channelId);
        const msg = await ch.messages.fetch(doc.messageId);
        await msg.delete().catch(() => {});
      } catch {}
      return interaction.reply({ ephemeral: true, content: '🗑️ Deleted reaction-roles config.' });
    }
  }
};
