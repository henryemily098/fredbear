const { Queue } = require("../data");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getVoiceConnection, createAudioResource, StreamType } = require("@discordjs/voice");
const { search } = require("scrape-youtube");
const { stream:playdl } = require("play-dl");
const { default:scdl } = require("soundcloud-downloader");
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
    let [type, sub] = interaction.customId.split("_");
    if(type.toLowerCase() === "song") {
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
        if(queue.message_id !== interaction.message.id) {
            let urlMessage = `https://discord.com/channels/${interaction.guildId}/${queue.songs[queue.index].textChannelId}/${queue.message_id}`;
            try {
                await interaction.reply({
                    content: `You're not using the real control! ${queue.message_id ? `[Click here to jump!](${urlMessage})` : ""}`,
                    ephemeral: true
                });
                await interaction.message.delete();
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let connection = getVoiceConnection(interaction.guildId)
        let { channel } = interaction.member.voice;
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
        console.log(sub.toLowerCase() !== "queue" && (!channel || channel.id !== connection.joinConfig.channelId));
        if(sub.toLowerCase() !== "queue" && (!channel || channel.id !== connection.joinConfig.channelId)) {
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
            return;
        }

        let index = action.components.map(i => i.data.custom_id).indexOf(interaction.customId);
        let component = action.components[index];

        if(sub.toLowerCase() === "player") {
            if(interaction.client.players[interaction.guildId].state.resource) {
                if(queue.playing) interaction.client.players[interaction.guildId].pause();
                else interaction.client.players[interaction.guildId].unpause();
                component.setEmoji(queue.playing ? "▶" : "⏸");
            }
            else {
                let stream = null;
                try {
                    let song = queue.songs[queue.index];
                    if(song.type === "youtube") {
                        let data = await playdl(song.url);
                        stream = { stream_data: data.stream, type: data.type }
                    }
                    else if(song.type === "spotify") {
                        if(!song.youtube_url) {
                            let results = await search(`${song.title} - ${song.artists.map(artist => artist.name).join(" & ")} Topic`);
                            song['youtube_url'] = results.videos[0].link;
                        }
            
                        queue.songs.splice(queue.index, 1);
                        let nextSongs = queue.songs.splice(queue.index, queue.songs.length);
                        queue.songs.push(song, ...nextSongs);
            
                        let data = await playdl(song.youtube_url);
                        stream = { stream_data: data.stream, type: data.type };
                    }
                    else if(song.type === "soundcloud") stream = { stream_data: await scdl.downloadFormat(song.url, scdl.FORMATS.MP3), type: StreamType.Arbitrary }
                } catch (error) {
                    console.log(error);
                    return;
                }
                
                let resource = createAudioResource(stream.stream_data, { inlineVolume: true, inputType: stream.type });
                resource.volume.setVolume(queue.volume / 100);
                
                component.setEmoji("⏸");
                interaction.client.players[interaction.guildId].play(resource);
                queue.playing = true;

                try {
                    await queue.save();
                } catch (error) {
                    console.log(error);
                }
            }
            
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
            
            if(queue.shuffle) queue.songs = interaction.client.shuffleArray(queue.songs);
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

        let queueId = `${interaction.user.id}-${interaction.guildId}`;
        if(!interaction.client.queue[queueId]) {
            interaction.client.queue[queueId] = {
                page: 1,
                first: 0,
                second: 5
            }
        }

        let currentSong = queue.songs[queue.index];
        let row = new ActionRowBuilder()
            .setComponents([
                new ButtonBuilder()
                    .setEmoji("<:Previous_Page:897314282872655983>")
                    .setCustomId("queue_btnLeft")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setEmoji("<:Next_Page:897289358187589663>")
                    .setCustomId("queue_btnRight")
                    .setStyle(ButtonStyle.Success)
            ]);
        if(sub === "btnLeft") {
            interaction.client.queue[queueId].page -= 1;
            interaction.client.queue[queueId].first -= 5;
            interaction.client.queue[queueId].second -= 5;
        }
        else if(sub === "btnRight") {
            interaction.client.queue[queueId].page += 1;
            interaction.client.queue[queueId].first += 5;
            interaction.client.queue[queueId].second += 5;
        }

        row.components[0].setDisabled(interaction.client.queue[queueId].first <= 0 ? true : false);
        row.components[1].setDisabled(interaction.client.queue[queueId].second >= queue.songs.length ? true : false);
        
        let components = [];
        if(queue.songs.length > 5) components.push(row);

        let djUser = interaction.client.users.cache.get(queue.dj_user_id);
        let currentSongRequester = interaction.client.users.cache.get(currentSong.requestedUserId);
        let page_count = Math.floor(queue.songs.length % 5 === 0 ? queue.songs.length / 5 : (queue.songs.length / 5) + 1);
        let content = `
            
\`\`\`css
▬▬▬▬▬▬ ${interaction.guild.name} ▬▬▬▬▬▬

Songs in Queue: ${queue.songs.length} │ Page: ${interaction.client.queue[queueId].page}/${page_count} | Current DJ: ${djUser ? djUser.username : "None"}

Current Song: 
${queue.index+1}). ${currentSong.title.length > 35 ? `${currentSong.title.substring(0, 32)}...` : currentSong.title} - [${currentSongRequester ? currentSongRequester.username : "Unknown User"}]

Queue Songs:
${queue.songs.splice(interaction.client.queue[queueId].first, 5).map((song, index) => {
    let requestedUser = interaction.client.users.cache.get(song.requestedUserId);
    return `${index+1+interaction.client.queue[queueId].first}). ${song.title.length > 35 ? `${song.title.substring(0, 32)}...` : song.title} - [${requestedUser ? requestedUser.username : "Unknown User"}]`;
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