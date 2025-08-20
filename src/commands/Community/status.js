const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Set the bot's status (Playing, Watching, Listening, etc.)"),

  async execute(interaction) {
    // Dropdown menu for activity type
    const select = new StringSelectMenuBuilder()
      .setCustomId("status-type")
      .setPlaceholder("Choose activity type...")
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

    await interaction.reply({ content: "Pick an activity type:", components: [row], ephemeral: true });
  },
};
