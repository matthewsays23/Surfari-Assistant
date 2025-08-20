const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");

const clientId = "1400669797804412969";
const guildId = "1185709036998504538";

module.exports = (client) => {
  client.handleCommands = async (commandFolders, path) => {
    client.commandArray = [];

    // Only keep directories (skip .DS_Store or other junk files)
    const validFolders = commandFolders.filter((folder) =>
      fs.statSync(`${path}/${folder}`).isDirectory()
    );

    for (const folder of validFolders) {
      const commandFiles = fs
        .readdirSync(`${path}/${folder}`)
        .filter((file) => file.endsWith(".js"));

      for (const file of commandFiles) {
        const command = require(`../commands/${folder}/${file}`);
        client.commands.set(command.data.name, command);
        client.commandArray.push(command.data.toJSON());
      }
    }

    const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
      try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationCommands(clientId), {
          body: client.commandArray,
        });

        console.log("Successfully reloaded application (/) commands.");
      } catch (error) {
        console.error(error);
      }
    })();
  };
};
