// src/commands/verify.js
const { SlashCommandBuilder } = require('discord.js');
const crypto = require('crypto');

const VERIFY_START_URL = process.env.VERIFY_START_URL || 'https://surfari.io/api/discord/oauth/start';
const STATE_SECRET = process.env.STATE_SECRET;

function signState(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Roblox account (Surfari OAuth) and get roles.'),
  async execute(interaction) {
    const stateObj = {
      d: interaction.user.id,         // Discord user id
      g: interaction.guildId,         // Guild id
      t: Date.now() + 15 * 60 * 1000, // 15 min exp
      v: 1,
    };
    const state = signState(stateObj);
    const url = `${VERIFY_START_URL}?state=${encodeURIComponent(state)}&purpose=discord-verify`;

    await interaction.reply({
      ephemeral: true,
      content: [
        `Verify with Surfari: ${url}`,
        '• Links your Discord ↔ Roblox',
        '• Updates your nickname',
        '• Grants Verified + group roles',
        '(Link expires in 15 minutes.)',
      ].join('\n'),
    });
  },
};
