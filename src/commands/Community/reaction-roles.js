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
        .addChannelOption(o =>
          o.setName('channel')
            .setDescription('Channel of the message')
            .setRequired(true),
        )
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Target message ID')
            .setRequired(true),
        )
        .addStringOption(o =>
          o.setName('mappings')
            .setDescription('EMOJI = @Role, separated by | or ;')
            .setRequired(true),
        )
        .addBooleanOption(o =>
          o.setName('clear')
            .setDescription('Clear all reactions first (default: false)')
            .setRequired(false),
        ),
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete reaction-roles config by message ID')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Message ID')
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const sub    = interaction.options.getSubcommand();
    const client = interaction.client;
    const db     = client.db;
    const coll   = db.collection('reactionRoles');

    try {
      // ---------------- BIND ----------------
      if (sub === 'bind') {
        const channel   = interaction.options.getChannel('channel', true);
        const messageId = interaction.options.getString('message_id', true);
        const text      = interaction.options.getString('mappings', true);
        const doClear   = interaction.options.getBoolean('clear') || false;

        // Basic permission sanity checks
        const me = await interaction.guild.members.fetchMe();
        const needed = ['ViewChannel', 'ReadMessageHistory', 'AddReactions', 'SendMessages'];
        const missing = needed.filter(p => !channel.permissionsFor(me)?.has(p));
        if (missing.length) {
          return interaction.reply({
            ephemeral: true,
            content: `I’m missing permissions in ${channel}: **${missing.join(', ')}**`,
          });
        }
        if (!me.permissions.has('ManageRoles')) {
          return interaction.reply({
            ephemeral: true,
            content: 'I need the **Manage Roles** permission to assign roles.',
          });
        }

        // Fetch the target message
        let msg;
        try {
          msg = await channel.messages.fetch(messageId);
        } catch {
          return interaction.reply({
            ephemeral: true,
            content: `❌ I can’t fetch message \`${messageId}\` in ${channel}.`,
          });
        }

        // --- Parse mappings input ---
        if (!text) {
          return interaction.reply({
            ephemeral: true,
            content: '❌ No mappings provided.',
          });
        }

        // Support both multiline and single-line (| or ; separators)
        let chunks;
        if (text.includes('\n')) {
          chunks = text.split('\n');
        } else {
          chunks = text.split(/[|;]/g);
        }

        const lines = chunks.map(l => l.trim()).filter(Boolean);

        const parsed = [];
        const errors = [];

        for (const line of lines) {
          const parts = line.split('=');
          if (parts.length !== 2) {
            errors.push(`Bad line: "${line}"`);
            continue;
          }

          const emojiRaw = parts[0].trim();
          const roleRaw  = parts[1].trim();

          // Resolve role
          let roleId = roleRaw.replace(/[<@&>]/g, '');
          if (!/^\d{5,}$/.test(roleId)) {
            const byName = interaction.guild.roles.cache.find(
              r => r.name.toLowerCase() === roleRaw.toLowerCase(),
            );
            if (!byName) {
              errors.push(`Unknown role: "${roleRaw}"`);
              continue;
            }
            roleId = byName.id;
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            errors.push(`Invalid role: ${roleId}`);
            continue;
          }
          if (role.position >= me.roles.highest.position) {
            errors.push(`Can’t assign **${role.name}** (role is >= my highest role).`);
            continue;
          }

          // Determine emojiKey for storage vs emojiForMessage for .react()
          let emojiKey = emojiRaw;
          if (isCustomEmojiString(emojiRaw)) {
            const id = extractCustomId(emojiRaw);
            if (!id) {
              errors.push(`Invalid custom emoji: "${emojiRaw}"`);
              continue;
            }
            emojiKey = id; // store ID for custom emojis
          } else {
            // unicode emoji: store the actual character
            emojiKey = emojiRaw;
          }

          parsed.push({
            emojiForMessage: emojiRaw, // what we call msg.react() with
            emojiKey,
            roleId,
          });
        }

        if (!parsed.length) {
          return interaction.reply({
            ephemeral: true,
            content: `❌ No valid mappings.\n${errors.join('\n') || ''}`,
          });
        }

        // Optionally clear previous reactions
        if (doClear) {
          try {
            await msg.reactions.removeAll();
          } catch (e) {
            errors.push(`Failed to clear reactions: ${e.message}`);
          }
        }

        // React on the message
        for (const p of parsed) {
          try {
            await msg.react(p.emojiForMessage);
          } catch (e) {
            errors.push(`Failed to react ${p.emojiForMessage}: ${e.message}`);
          }
        }

        // --- Merge with existing config (append/override by emoji) ---
        let newMappings = parsed.map(p => ({
          emojiKey: p.emojiKey,
          roleId: p.roleId,
        }));

        const existing = await coll.findOne({
          guildId: interaction.guild.id,
          messageId: msg.id,
        });

        if (existing?.mappings?.length) {
          const map = new Map();
          for (const m of existing.mappings) {
            if (m?.emojiKey && m?.roleId) {
              map.set(m.emojiKey, m.roleId);
            }
          }
          for (const m of newMappings) {
            map.set(m.emojiKey, m.roleId);
          }
          newMappings = [...map.entries()].map(([emojiKey, roleId]) => ({ emojiKey, roleId }));
        }

        const cfg = {
          guildId: interaction.guild.id,
          channelId: channel.id,
          messageId: msg.id,
          mappings: newMappings,
          createdBy: interaction.user.id,
          createdAt: new Date(),
        };

        await coll.updateOne(
          { guildId: cfg.guildId, messageId: cfg.messageId },
          { $set: cfg },
          { upsert: true },
        );

        console.log('RR BIND: saved config for message', msg.id, '->', cfg);

        return interaction.reply({
          ephemeral: true,
          content:
            `✅ Bound reaction roles to message \`${msg.id}\` in ${channel}.\n` +
            (errors.length ? `\nWarnings:\n${errors.join('\n')}` : ''),
        });
      }

      // ---------------- DELETE ----------------
      if (sub === 'delete') {
        const messageId = interaction.options.getString('message_id', true);

        await coll.deleteOne({
          guildId: interaction.guild.id,
          messageId,
        });

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
      // Do NOT rethrow, to avoid "Unknown interaction" from a second reply
    }
  },
};
