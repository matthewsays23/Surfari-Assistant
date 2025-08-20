const { Interaction } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // 🔹 Slash Command Handler
      if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client);
      }

      // 🔹 Dropdown (StringSelectMenu) Handler
      else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "status-type") {
          const activityType = parseInt(interaction.values[0]);

          // Show modal for custom status text
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
          const modal = new ModalBuilder()
            .setCustomId(`status-modal-${activityType}`)
            .setTitle("Set Bot Status");

          const input = new TextInputBuilder()
            .setCustomId("status-text")
            .setLabel("Enter status text")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. Playing Roblox")
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
      }

      // 🔹 Modal Submit Handler
      else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("status-modal-")) {
          const activityType = parseInt(interaction.customId.split("-")[2]);
          const statusText = interaction.fields.getTextInputValue("status-text");

          client.user.setActivity(statusText, { type: activityType });
          return interaction.reply({ content: `✅ Status set to: **${statusText}**`, ephemeral: true });
        }
      }
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "⚠️ There was an error executing this interaction.", ephemeral: true });
      } else {
        await interaction.reply({ content: "⚠️ There was an error executing this interaction.", ephemeral: true });
      }
    }
  },
};
