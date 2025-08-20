const { ModalBuilder, Interaction, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");


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

const modal = new ModalBuilder()
  .setCustomId(`status-modal-${activityType}`)
  .setTitle("Almost There! 🐠");

const input = new TextInputBuilder()
  .setCustomId("status-text")
  .setLabel("What should my status say?")
  .setStyle(TextInputStyle.Short)
  .setPlaceholder("Watching the sunset 🌅")
  .setRequired(true);

modal.addComponents(new ActionRowBuilder().addComponents(input));
await interaction.showModal(modal);
        }
      }

      // 🔹 Modal Submit Handler
      else if (interaction.isModalSubmit()) {
        if (interaction.isModalSubmit() && interaction.customId.startsWith("status-modal-")) {
  const activityType = parseInt(interaction.customId.split("-")[2]);
  const statusText = interaction.fields.getTextInputValue("status-text");

  client.user.setActivity(statusText, { type: activityType });

          const username = interaction.user.globalName || interaction.user.username;
          
  const confirmEmbed = new EmbedBuilder()
    .setColor("#81b46b")
    .setTitle(`🏄 Nice, ${username}! Loving the vibe change!`)
    .setDescription(`Successfully sent log to set website! \n\nFeed: **${statusText}**!`)
    .setFooter({ text: "Surfari.io · 2025", iconURL: "https://i.imgur.com/Q2KRVBO.png" })

  await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
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


