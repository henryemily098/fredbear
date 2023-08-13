const { Queue } = require("../data");
const { displayQueue } = require("../src");

module.exports = {
    data: [
        {
            name: "queue",
            description: "View queue in server."
        },
        {
            name: "q",
            description: "View queue in server."
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

        let queue = null;
        try {
            queue = await Queue.findOne({ guild_id: interaction.guildId });
        } catch (error) {
            console.log(error);
        }
        if(!queue) {
            try {
                await interaction.reply({
                    content: "There's no queue in this server!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        
        try {
            await displayQueue(interaction, client);
        } catch (error) {
            console.log(error);
        }

    }
}