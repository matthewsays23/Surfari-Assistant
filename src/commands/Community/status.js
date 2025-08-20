// src/commands/util/status.js
const { 
  SlashCommandBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ActionRowBuilder, 
  EmbedBuilder 
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("(Change Status)"),

  async execute(interaction) {
    // Tropical-themed embed
    const embed = new EmbedBuilder()
      .setColor("#81b46b")
      .setTitle("🏄 Ready to change the vibe?")
      .setDescription("Pick a status type below and set my vibe!")
      .setFooter({ text: "Surfari.io · 2025", iconURL: "https://i.imgur.com/Q2KRVBO.png" })

    // Dropdown menu
    const select = new StringSelectMenuBuilder()
      .setCustomId("status-type")
      .setPlaceholder("☀️ Choose the vibe")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Playing")
          .setValue("0"), // 0 = Playing
        new StringSelectMenuOptionBuilder()
          .setLabel("Streaming")
          .setValue("1"), // 1 = Streaming
        new StringSelectMenuOptionBuilder()
          .setLabel("Listening")
          .setValue("2"), // 2 = Listening
        new StringSelectMenuOptionBuilder()
          .setLabel("Watching")
          .setValue("3"), // 3 = Watching
        new StringSelectMenuOptionBuilder()
          .setLabel("Competing")
          .setValue("5")  // 5 = Competing
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
