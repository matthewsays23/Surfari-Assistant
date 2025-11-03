// src/commands/Community/reaction-roles.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
            .setDescription('Clear all reactions first (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete reaction-roles config by message ID')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const sub = interaction.options.getSubcommand();
    const client = interaction.client;

    try {
      if (sub === 'bind') {
        const channel   = interaction.options.getChannel('channel', true);
        const messageId = interaction.options.getString('message_id', true);
        const text      = interaction.options.getString('mappings', true);
        const doClear   = interaction.options.getBoolean('clear') || false;

        const me = await interaction.guild.members.fetchMe();
        const need = ['ViewChannel','ReadMessageHistory','AddReactions','SendMessages'];
        const missing = need.filter(p => !channel.permissionsFor(me)?.has(p));
        if (missing.length) {
          return interaction.reply({
            ephemeral: true,
            content: `I’m missing permissions in ${channel}: **${missing.join(', ')}**`,
          });
        }
        if (!me.permissions.has('ManageRoles')) {
          return interaction.reply({
            ephemeral: true,
            content: 'I need the **Manage Roles** permission.',
          });
        }

        // Fetch the existing message
        let msg;
        try {
          msg = await channel.messages.fetch(messageId);
        } catch {
          return interaction.reply({
            ephemeral: true,
            content: `❌ I can’t fetch message \`${messageId}\` in ${channel}.`,
          });
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

          // Resolve role
          let roleId = roleRaw.replace(/[<@&>]/g, '');
          if (!/^\d{5,}$/.test(roleId)) {
            const byName = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleRaw.toLowerCase());
            if (!byName) { errors.push(`Role not found: "${roleRaw}"`); continue; }
            roleId = byName.id;
          }
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) { errors.push(`Invalid role: ${roleId}`); continue; }
          if (role.position >= me.roles.highest.position) {
            errors.push(`Can’t assign **${role.name}** (role is >= my highest role).`);
            continue;
          }

          let emojiForMessage = emojiRaw;
          let emojiKey        = emojiRaw;
          if (isCustomEmojiString(emojiRaw)) {
            const id = extractCustomId(emojiRaw);
            emojiKey = id;   // custom → id
          } else {
            emojiKey = emojiRaw; // unicode
          }

          parsed.push({ emojiForMessage, emojiKey, roleId });
        }

        if (!parsed.length) {
          return interaction.reply({
            ephemeral: true,
            content: `❌ No valid mappings.\n${errors.join('\n') || ''}`,
          });
        }

        // Optionally clear reactions
        if (doClear) {
          try { await msg.reactions.removeAll(); } catch {}
        }

        // React with emojis
        for (const p of parsed) {
          try { await msg.react(p.emojiForMessage); }
          catch (e) { errors.push(`Failed to react ${p.emojiForMessage}: ${e.message}`); }
        }

        // Build config
        const cfg = {
          guildId: interaction.guild.id,
          channelId: channel.id,
          messageId: msg.id,
          mappings: parsed.map(p => ({ emojiKey: p.emojiKey, roleId: p.roleId })),
          createdBy: interaction.user.id,
          createdAt: new Date(),
        };

        // In-memory store
        if (!client.reactionRoles) client.reactionRoles = new Map();
        client.reactionRoles.set(msg.id, cfg);
        console.log('RR BIND: saved config for message', msg.id, '->', cfg);

        return interaction.reply({
          ephemeral: true,
          content:
            `✅ Bound reaction roles to message \`${msg.id}\` in ${channel}.\n` +
            (errors.length ? `\nWarnings:\n${errors.join('\n')}` : ''),
        });
      }

      if (sub === 'delete') {
        const messageId = interaction.options.getString('message_id', true);

        if (client.reactionRoles) {
          client.reactionRoles.delete(messageId);
        }

        return interaction.reply({
          ephemeral: true,
          content: '🗑️ Deleted reaction-roles config (message unchanged).',
        });
      }
    } catch (err) {
      console.error('RR command error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          ephemeral: true,
          content: '❌ Something went wrong while setting up reaction roles.',
        }).catch(() => {});
      }
    }
  },
};
