const { Queue } = require("../data");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const queueHandle = require("./queue");

/**
 * 
 * @param {import("discord.js").CommandInteraction} interaction 
 */
async function interactionCommandHandle(interaction) {
    if(!interaction.inGuild()) return;
    let { commandName } = interaction;
    let command = interaction.client.commands.get(commandName);
    if(command) {
        try {
            await command.run(interaction, interaction.client);
        } catch (error) {
            console.log(error);
        }
    }
    else {
        try {
            await interaction.reply({
                content: "No command found!",
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }
    }
}

/**
 * 
 * @param {import("discord.js").ButtonInteraction} interaction 
 */
async function interactionButtonHandle(interaction) {
    let [type, sub, num, filter] = interaction.customId.split("_");
    if(type.toLowerCase() === "song") {
        let queue = null;
        let connection = getVoiceConnection(interaction.guildId)
        let { channel } = interaction.member.voice;
        let action = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId("player")
                    .setEmoji(queue.playing ? "⏸" : "▶️")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("loop")
                    .setEmoji(queue.loop === 0 ? "❌" : queue.loop === 1 ? "🔁" : queue.loop === 2 ? "🔂" : "❌")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("shuffle")
                    .setEmoji("🔀")
                    .setStyle(queue.shuffle ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("queue")
                    .setEmoji("<:queue:1064506068501282856>")
                    .setStyle(ButtonStyle.Danger)
            ]);
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
                await interaction.message.delete();
            } catch (error) {
                console.log(error);
            }
            return;
        }
        if(!channel && sub.toLowerCase() === "queue") {
            try {
                await interaction.reply({
                    content: "You have to join voice channel first.",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        if(!connection) {
            try {
                await queue.deleteOne();
                await interaction.reply({
                    content: "I'm already left voice channel!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error)
            }
        }
        if(sub.toLowerCase() !== "queue" && channel.id !== connection.joinConfig.channelId) {
            let { channelId } = connection.joinConfig;
            try {
                await interaction.reply({
                    content: `You have to join <#${channelId}> first.`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let confirm = false;
        for (let i = 0; i < interaction.member.roles.cache.size; i++) {
            let role = interaction.member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < interaction.client.permissions.length; i++) {
                if((permissions & interaction.client.permissions[i]) === interaction.client.permissions[i]) confirm = true;
            }
        }
        if(sub.toLowerCase() === "queue") confirm = true;
        if(queue.dj_user_id === interaction.user.id) confirm = true;
        if(!confirm) {
            try {
                await interaction.reply({
                    content: "You can't use this control!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
        }

        let index = action.components.map(i => i.data.custom_id).indexOf(i.customId);
        let component = action.components[index];

        if(sub.toLowerCase() === "player") {
            if(queue.playing) interaction.client.players[interaction.guildId].pause();
            else interaction.client.players[interaction.guildId].unpause();
            component.setEmoji(queue.playing ? "▶️" : "⏸");
            
            try {
                await interaction.update({ components: [action] });
            } catch (error) {
                console.log(error);
            }
            return;
        }
        else if(sub.toLowerCase() === "loop") {
            if(queue.loop === 2) queue.loop = 0;
            else queue.loop++;
            component.setEmoji(queue.loop === 0 ? "❌" : queue.loop === 1 ? "🔁" : queue.loop === 2 ? "🔂" : "❌");
        }
        else if(sub.toLowerCase() === "shuffle") {
            queue.shuffle = !queue.shuffle;
            component.setStyle(queue.shuffle ? ButtonStyle.Primary : ButtonStyle.Secondary);
            
            if(queue.shuffle) queue.songs = client.shuffleArray(queue.songs);
            else queue.songs = queue.songs.sort((a, b) => a.index - b.index);
        }
        else if(sub.toLowerCase() === "queue") {
            try {
                await queueHandle(interaction, interaction.client);
            } catch (error) {
                console.log(error);
            }
            return;
        }

        try {
            await queue.save();
            await interaction.update({ components: [action] });
        } catch (error) {
            console.log(error);
        }
    }
    if(type.toLowerCase() === "queue") {
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
                await interaction.message.delete();
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let number = parseInt(num);
        let isFilter = filter.toLowerCase() === "filter";
        let currentSong = queue.songs[queue.index];
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
            if(sub === "btnLeft") {
                number -= 5;
                for (let i = 0; i < row.components.length; i++) {
                    let button = row.components[i];
                    let typeBtn = button.data.custom_id.split("_")[1];
                    if(typeBtn === "btnLeft") button.setCustomId(`queue_btnLeft_${number}_${isFilter ? "filter" : "nonfilter"}`);
                    else if(typeBtn === "btnRight") button.setCustomId(`queue_btnLeft_${number + 5}_${isFilter ? "filter" : "nonfilter"}`)
                    
                    if(number === 0 && typeBtn === "btnLeft") button.setDisabled(true);
                    else if(number > 0 && typeBtn === "btnLeft") button.setDisabled(false);
                }
            }
            else if(sub === "btnRight") {
                number += 5;
                for (let i = 0; i < row.components.length; i++) {
                    let button = row.components[i];
                    let typeBtn = button.data.custom_id.split("_")[1];
                    if(typeBtn === "btnLeft") button.setCustomId(`queue_btnLeft_${number - 5}_${isFilter ? "filter" : "nonfilter"}`);
                    else if(typeBtn === "btnRight") button.setCustomId(`queue_btnLeft_${number}_${isFilter ? "filter" : "nonfilter"}`)
                
                    if(number >= queue.songs.length && typeBtn === "btnRight") button.setDisabled(true);
                    else if(number > 0 && typeBtn === "btnRight") button.setDisabled(false);
                }
            }

            let components = [];
            if(queue.songs.length > 5) components.push(row);

            let djUser = interaction.client.users.cache.get(queue.dj_user_id);
            let currentSongRequester = interaction.client.users.cache.get(currentSong.requestedUserId);
            let page_count = Math.floor(queue.songs.length % 5 === 0 ? queue.songs.length / 5 : (queue.songs.length / 5) + 1);
            let content = `
\`\`\`css
▬▬▬▬▬▬ ${interaction.guild.name} ▬▬▬▬▬▬

Songs in Queue: ${queue.songs.length} │ Page: 1/${page_count} | Current DJ: ${djUser ? djUser.username : "None"}

Current Song: 
${queue.index+1}). ${currentSong.title.length > 35 ? `${currentSong.title.substring(0, 32)}...` : currentSong.title} - [${currentSongRequester ? currentSongRequester.username : "Unknown User"}]

Queue Songs:
${queue.songs.splice(sub === "btnLeft" ? number : number - 5, 5).map((song, index) => {
    let requestedUser = interaction.client.users.cache.get(song.requestedUserId);
    return `${index+1}). ${song.title.length > 35 ? `${song.title.substring(0, 32)}...` : song.title} - [${requestedUser ? requestedUser.username : "Unknown User"}]`;
}).join("\n")}
\`\`\`
`;
            try {
                await interaction.update({
                    content, components
                });
            } catch (error) {
                console.log(error);
            }
    }
}

module.exports = {
    interactionButtonHandle,
    interactionCommandHandle
}