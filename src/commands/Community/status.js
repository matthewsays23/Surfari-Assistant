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
Interaction Handler for Dropdown
js
Copy
Edit
// src/events/interactionCreate.js
const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle dropdown
    if (interaction.isStringSelectMenu() && interaction.customId === "status-type") {
      const activityType = parseInt(interaction.values[0]);

      // Open modal to enter status text
      const modal = new ModalBuilder()
        .setCustomId(`status-modal-${activityType}`)
        .setTitle("Set Bot Status");

      const input = new TextInputBuilder()
        .setCustomId("status-text")
        .setLabel("Enter status text")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. Playing Roblox")
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // Handle modal submit
    if (interaction.type === 5 && interaction.customId.startsWith("status-modal-")) {
      const activityType = parseInt(interaction.customId.split("-")[2]);
      const statusText = interaction.fields.getTextInputValue("status-text");

      interaction.client.user.setActivity(statusText, { type: activityType });

      await interaction.reply({ content: `✅ Status set to: ${statusText}`, ephemeral: true });
    }
  },
};
