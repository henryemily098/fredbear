const { Queue } = require("../data");
const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
    data: [
        {
            name: "skip",
            description: "Skip current song."
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
        
        if(connection && connection.joinConfig.channelId !== channel.id) {
            try {
                await interaction.reply({
                    content: `You need to join <#${connection.joinConfig.channelId}>!`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let embed = new EmbedBuilder().setColor(client.config.defaultColor);
        let voiceChannel = client.channels.cache.get(channelId);
        if(!voiceChannel || !voiceChannel.isVoiceBased()) return;

        let members = voiceChannel.members.filter(m => !m.user.bot && m.user.id !== client.user.id);
        if(members.size === 1) {
            client.players[interaction.guildId].stop();
            embed.setAuthor({ name: "| Skip current song", iconURL: client.user.displayAvatarURL() });
            try {
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        if(queue.votes.includes(interaction.user.id)) {
            embed.setAuthor({
                name: `| Current votes count: ${members.size}/${queue.votes.length}`,
                iconURL: client.user.displayAvatarURL({ size: 1024 })
            });
            try {
                await interaction.reply({
                    content: "You're already vote to skip!",
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        queue.votes.push(interaction.user.id);
        embed.setAuthor({
            name: `| Current votes count: ${members.size}/${queue.votes.length}`,
            iconURL: client.user.displayAvatarURL({ size: 1024 })
        });
        try {
            await queue.save();
            await interaction.reply({
                embeds: [embed],
                content: `${interaction.user.tag} vote to skip!`
            });
        } catch (error) {
            console.log(error);
        }

        if(queue.votes.length >= members.size) {
            client.players[interaction.guildId].stop();
            embed.setAuthor({
                name: "| Skip current song",
                iconURL: client.user.displayAvatarURL({ size: 1024 })
            });
            try {
                await interaction.channel.send({ embeds: [embed] });
            } catch (error) {
                console.log(error);
            }
        }
        return;

    }
}