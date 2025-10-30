const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const crypto = require("crypto");

function signState(discordId) {
  const ts = Date.now();
  const body = `${discordId}.${ts}`;
  const hash = crypto.createHmac("sha256", process.env.STATE_SECRET)
    .update(body)
    .digest("hex");
  return `${hash}.${discordId}.${ts}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Link your Roblox account to Surfari"),

  async execute(interaction) {
    const state = signState(interaction.user.id);
    const authUrl = `${process.env.SURFARI_BASE_URL}/auth/roblox?state=${encodeURIComponent(state)}`;

    const embed = new EmbedBuilder()
      .setColor("81b46b")
      .setTitle("🏄 Surfari Verification")
      .setDescription(
        "**Connect your Roblox account** to unlock Surfari roles.\n\n" +
        "🔒 _Secure Roblox OAuth — we never see your password_"
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Verify with Roblox")
        .setURL(authUrl)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};