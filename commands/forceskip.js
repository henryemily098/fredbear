const { Queue } = require("../data");
const { getVoiceConnection } = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    data: [
        {
            name: "forceskip",
            description: "Force skip without vote."
        },
        {
            name: "fs",
            description: "Force skip without vote"
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

        let { member } = interaction;
        let { channel } = member.voice;

        let connection = getVoiceConnection(interaction.guildId);
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
        if(!channel) {
            try {
                await interaction.reply({
                    content: "You must join voice channel first!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        
        let { channelId } = connection.joinConfig;
        if(channelId !== channel.id) {
            try {
                await interaction.reply({
                    content: `You must join <#${channelId}> first!`, 
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let confirm = false;
        for (let i = 0; i < member.roles.cache.size; i++) {
            let role = member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < client.permissions.length; i++) {
                if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
            }
        }
        if(queue.dj_user_id === interaction.user.id) confirm = true;
        if(!confirm) {
            try {
                await interaction.reply({
                    content: "You cannot use this command yet!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        client.players[interaction.guildId].stop();

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: "| Skip current song", iconURL: client.user.displayAvatarURL() });
        try {
            await interaction.reply({ embeds: [embed] })
        } catch (error) {
            console.log(error);
        }

    }
}