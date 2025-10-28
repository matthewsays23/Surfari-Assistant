// verify-command.js (CommonJS)
const { 
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
  return `${hash}.${discordId}.${ts}`; // hash.discordId.ts
}

async function handleVerify(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "verify") return;

  const state = signState(interaction.user.id);

  const authUrl = `${process.env.SURFARI_BASE_URL}/auth/roblox?state=${encodeURIComponent(state)}`;

  const embed = new EmbedBuilder()
    .setColor(0xFF6A00) // Surfari orange
    .setTitle("🪸 Surfari Verification")
    .setDescription(
      "**Connect your Roblox account** to unlock Surfari roles.\n\n" +
      "🔒 _Secure Roblox OAuth — we never see your password_"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Verify with Roblox")
      .setStyle(ButtonStyle.Link)
      .setURL(authUrl)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

module.exports = { handleVerify };
