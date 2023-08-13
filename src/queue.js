const { Queue } = require("../data");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

/**
 * 
 * @param {import('discord.js').Interaction} interaction 
 * @param {import('./client')} client 
 */
async function queue(interaction, client) {
    let queue = null;
    try {
        queue = await Queue.findOne({ guild_id: interaction.guildId });
    } catch (error) {
        console.log(error);
    }

    let row = new ActionRowBuilder()
        .setComponents([
            new ButtonBuilder()
                .setEmoji("<:Previous_Page:897314282872655983>")
                .setCustomId("queue_btnLeft_0_nonfilter")
                .setDisabled(true)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setEmoji("<:Next_Page:897289358187589663>")
                .setCustomId("queue_btnRight_5_nonfilter")
                .setDisabled(false)
                .setStyle(ButtonStyle.Success)
        ]);
    
    let currentSong = queue.songs[queue.index];
    let djUser = client.users.cache.get(queue.dj_user_id);
    let currentSongRequester = client.users.cache.get(currentSong.requestedUserId)
    let page_count = Math.floor(queue.songs.length % 5 === 0 ? queue.songs.length / 5 : (queue.songs.length / 5) + 1);
    let content = `
\`\`\`css
▬▬▬▬▬▬ ${interaction.guild.name} ▬▬▬▬▬▬

Songs in Queue: ${queue.songs.length} │ Page: 1/${page_count} | Current DJ: ${djUser ? djUser.username : "None"}

Current Song: 
${queue.index+1}). ${currentSong.title.length > 35 ? `${currentSong.title.substring(0, 32)}...` : currentSong.title} - [${currentSongRequester ? currentSongRequester.username : "Unknown User"}]

Queue Songs: 
${queue.songs.splice(0, 5).map((song, index) => {
    let requestedUser = client.users.cache.get(song.requestedUserId);
    return `${index+1}). ${song.title.length > 35 ? `${song.title.substring(0, 32)}...` : song.title} - [${requestedUser ? requestedUser.username : "Unknown"}]`;
}).join("\n")}
\`\`\`
`;

    let components = [];
    if(page_count > 1) components.push(row);

    let message = null;
    try {
        message = await interaction.reply({ content, components, ephemeral: true, fetchReply: true });
    } catch (error) {
        console.log(error);
    }
    if(!message) {
        try {
            await interaction.reply({
                content: "There's something wrong while try to display queue, try again.",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
        return;
    }

}

module.exports = queue;