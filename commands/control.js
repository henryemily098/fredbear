const { Queue } = require("../data");
const { displayQueue } = require("../src");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
    data: [
        {
            name: "control",
            description: "Re-send control message."
        },
        {
            name: "ctrl",
            description: "Re-send control message."
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
            let song = queue.songs[queue.index];
            let embed = new EmbedBuilder()
                .setColor(client.config.defaultColor)
                .setAuthor({ name: "| Now Playing", iconURL: client.user.displayAvatarURL({ size: 1024 }) })
                .setDescription(`[${song.title}](${song.url}) - [<@${song.requestedUserId}>]`);
    
            let action = new ActionRowBuilder()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId("song_player")
                        .setEmoji("⏸")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("song_loop")
                        .setEmoji(queue.loop === 0 ? "❌" : queue.loop === 1 ? "🔁" : queue.loop === 2 ? "🔂" : "❌")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("song_shuffle")
                        .setEmoji("🔀")
                        .setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId("song_queue")
                        .setEmoji("<:queue:1064506068501282856>")
                        .setStyle(ButtonStyle.Danger)
                ]);
    
            let message = null;
            try {
                message = await interaction.reply({
                    embeds: [embed],
                    components: [action],
                    fetchReply: true
                });
            } catch (error) {
                console.log(error);
            }
            if(!message) return;

            queue.message_id = message.id;
            await queue.save();
        } catch (error) {
            console.log(error);
        }

    }
}