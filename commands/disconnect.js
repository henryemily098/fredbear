const { Queue } = require("../data");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
    data: [
        {
            name: "disconnect",
            description: "Leave from voice channel.",
        },
        {
            name: "leave",
            description: "Leave from voice channel."
        },
        {
            name: "dc",
            description: "Leave from voice channel."
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

        let queue = null;
        let connection = getVoiceConnection(interaction.guildId);
        try {
            queue = await Queue.findOne({ guild_id: interaction.guildId });
        } catch (error) {
            console.log(error);
        }

        if(!connection) {
            try {
                if(queue) await queue.deleteOne();
                await interaction.reply({
                    content: "I'm already leave voice channel!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let { channelId } = connection.joinConfig;
        if(!channel || channel.id !== channelId) {
            try {
                await interaction.reply({
                    content: `You need to join <#${channelId}> first!`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        if(queue) {
            let confirm = false;
            for (let i = 0; i < member.roles.cache.size; i++) {
                let role = member.roles.cache.toJSON()[i];
                let permissions = parseInt(role.permissions.bitfield.toString());
                for (let i = 0; i < client.permissions.length; i++) {
                    if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
                }
            }
            if(queue.dj_user.id === interaction.user.id) confirm = true;
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
            if(queue.message_id) {
                try {
                    let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                    let messages = await channel.messages.fetch();
                    let message = messages.get(queue.message_id);
                    if(message) await message.delete();
                } catch (error) {
                    console.log(error);
                }
            }

            try {
                await queue.deleteOne();
            } catch (error) {
                console.log(error);
            }
        }
        
        connection.destroy();
        try {
            await interaction.reply({ content: "<:check_mark:819771972283662367>Disconnect from voice channel!" });
        } catch (error) {
            console.log(error);
        }

    }
}