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
  .setColor("81b46b") // Surfari green accent
  .setTitle("🏄 Surfari Verification")
  .setDescription(
    "🌴 **Welcome to Surfari!**\n" +
    "To access exclusive channels and roles, please verify your Roblox account.\n\n",
    "🔒 *We never ask for or store your Roblox password.*\n\n"
  )
  .setFooter({ text: "Surfari.io", iconURL: "https://drive.google.com/u/0/drive-viewer/AKGpihYGQFgOq5m-JqAH3FrzeOkwtliXQi78kjf0X8l5FbiK_QYcSIGh51Fhhx0hysd5HsnJmpzNHHJ4_pszwH9LF2aXstje6UAQta0=s2560" })
  .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setLabel("🌊 Verify with Roblox")
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