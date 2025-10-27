const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const SURFARI_API = process.env.SURFARI_API || 'https://surfari.onrender.com';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Show weekly Surfari playtime (minutes).')
    .addSubcommand(sc => sc.setName('user')
      .setDescription('Show a specific Roblox user.')
      .addStringOption(o => o.setName('roblox_id').setDescription('Roblox user ID').setRequired(true)))
    .addSubcommand(sc => sc.setName('me').setDescription('Use your linked Roblox ID')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    let robloxId;
    if (interaction.options.getSubcommand() === 'user') {
      robloxId = interaction.options.getString('roblox_id');
    } else {
      const links = interaction.client?.db?.collection?.('links'); // if you attach db on client; else fetch via your db helper
      if (!links) return interaction.editReply('Link DB not available.');
      const link = await links.findOne({ discordId: interaction.user.id });
      if (!link) return interaction.editReply('You are not linked. Use /verify first.');
      robloxId = link.robloxId;
    }

    try {
      const r = await fetch(`${SURFARI_API}/stats/quota/user/${robloxId}`, { timeout: 12000 });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();

      const mins = Math.round(data.minutes || 0);
      const hrs = (mins / 60).toFixed(mins >= 60 ? 1 : 0);
      const quota = data.requiredMinutes || process.env.QUOTA_MIN || 30;

      const embed = new EmbedBuilder()
        .setTitle(`Surfari Activity — ${robloxId}`)
        .setDescription([
          `**This Week:** ${mins} min (${hrs}h)`,
          `**Quota:** ${quota} min — ${data.met ? '✅ Met' : `❌ Need ${Math.max(0, quota - mins)} min`}`,
          '',
          `**Window:** ${new Date(data.weekStart).toLocaleString()} → ${new Date(data.weekEnd).toLocaleString()}`,
        ].join('\n'))
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      await interaction.editReply('Could not fetch activity right now.');
    }
  }
};