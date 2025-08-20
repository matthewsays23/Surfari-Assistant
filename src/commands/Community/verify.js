const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const crypto = require("crypto");

function makeState(discordId) {
  return crypto.createHash("sha256")
    .update(discordId + process.env.STATE_SECRET)
    .digest("hex") + "." + discordId;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("🌴 Link your Roblox account to get roles")
    .setDMPermission(true),

  async execute(interaction) {
    const state = makeState(interaction.user.id);
    const url = `${process.env.WEB_BASE_URL}/auth/roblox?state=${encodeURIComponent(state)}`;
const username = interaction.user.globalName || interaction.user.username;

    const embed = new EmbedBuilder()
      .setColor("#81b46b")
      .setTitle(`🏄 Let's get you verified, ${username}!`)
      .setDescription("Tap the link to verify your Roblox account and sync your roles.")
      .setFooter({ text: "Surfari.io · 2025", iconURL: "https://i.imgur.com/Q2KRVBO.png" })

    await interaction.reply({ embeds: [embed], ephemeral: true });
    await interaction.followUp({ content: `🌺 **Verify here:** ${url}`, ephemeral: true });
  }
};