// src/commands/Community/verify.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const crypto = require("crypto");

function makeState(discordId) {
  // signed state = <sha256>.<discordId>
  return (
    crypto
      .createHash("sha256")
      .update(discordId + process.env.STATE_SECRET)
      .digest("hex") +
    "." +
    discordId
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("🌴 Link your Roblox account to get roles")
    .setDMPermission(true),

  async execute(interaction) {
    const username = interaction.user.globalName || interaction.user.username;
    const state = makeState(interaction.user.id);
    const url = `${process.env.WEB_BASE_URL}/auth/roblox?state=${encodeURIComponent(
      state
    )}`;

    const embed = new EmbedBuilder()
      .setColor("#81b46b")
      .setTitle(`🏄 Nice, ${username}! Let’s get you verified!`)
      .setDescription("Tap the button below to verify on Surfari and sync your roles.")
      .setFooter({
        text: "Surfari.io • 2025",
        iconURL: "https://i.imgur.com/hTentw2.png",
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Verify")
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setEmoji("🔒")
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
