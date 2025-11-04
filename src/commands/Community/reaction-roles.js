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

    const sub    = interaction.options.getSubcommand();
    const client = interaction.client;
    const db     = client.db;
    const coll   = db.collection('reactionRoles');

    if (sub === 'bind') {
      const channel   = interaction.options.getChannel('channel', true);
      const messageId = interaction.options.getString('message_id', true);
// --- Parse mappings input ---
const text = interaction.options.getString("mappings");
if (!text) return interaction.reply({ ephemeral: true, content: "❌ No mappings provided." });

// Support both multiline and single-line (| or ; separators)
let chunks;
if (text.includes('\n')) {
  chunks = text.split('\n');
} else {
  chunks = text.split(/[|;]/g);
}

const lines = chunks.map(l => l.trim()).filter(Boolean);

// We'll collect successful mappings here
const parsed = [];
const errors = [];

for (const line of lines) {
  const parts = line.split('=');
  if (parts.length !== 2) {
    errors.push(`Bad line: "${line}"`);
    continue;
  }

  const emojiRaw = parts[0].trim();
  const roleRaw = parts[1].trim();

  // Try to resolve the role mention or name
  const role =
    interaction.guild.roles.cache.get(roleRaw.replace(/[<@&>]/g, "")) ||
    interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleRaw.toLowerCase());

  if (!role) {
    errors.push(`Unknown role: "${roleRaw}"`);
    continue;
  }

  parsed.push({ emojiKey: emojiRaw, roleId: role.id });
}

if (!parsed.length) {
  return interaction.reply({
    ephemeral: true,
    content: `❌ No valid mappings.\n${errors.join("\n") || ""}`,
  });
}
      // Optional: clear reactions
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

      // ✅ Persist to Mongo for reaction events
      await coll.updateOne(
        { guildId: cfg.guildId, messageId: cfg.messageId },
        { $set: cfg },
        { upsert: true }
      );

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

      await coll.deleteOne({ guildId: interaction.guild.id, messageId });

      return interaction.reply({
        ephemeral: true,
        content: '🗑️ Deleted reaction-roles config (message unchanged).',
      });
    }
  },
};
