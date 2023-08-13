const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { getVoiceConnection, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, entersState, VoiceConnectionStatus } = require("@discordjs/voice");

const { search } = require("scrape-youtube");
const { stream:playdl } = require("play-dl");
const { default:scdl } = require("soundcloud-downloader");
const { Queue } = require("../data");

/**
 * 
 * @param {object} song 
 * @param {string} guild_id 
 * @param {import("./client")} client 
 */
async function play(song, guild_id, client) {

    let queue = null;
    let connection = getVoiceConnection(guild_id);

    try {
        queue = await Queue.findOne({ guild_id });
    } catch (error) {
        console.log(error);
    }

    if(!connection) {
        delete client.players[guild_id];
        if(queue) {
            try {
                await queue.deleteOne();
            } catch (error) {
                console.log(error);
            }
        }
        return;
    }
    if(!song) {
        delete client.players[guild_id];
        if(queue) {
            try {
                await queue.deleteOne();
            } catch (error) {
                console.log(error);
            }
        }
        return;
    }

    let stream = null;
    try {
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
        endedHandler(guild_id, client).catch(console.log);
        return;
    }

    const resource = createAudioResource(stream.stream_data, { inlineVolume: true, inputType: stream.type });
    resource.volume.setVolume(queue.volume / 100);
    if(!client.players[guild_id]) {
        const player = createAudioPlayer();
        player
            .on(AudioPlayerStatus.Playing, async() => {
                try {
                    queue.playing = true;
                    await queue.save();
                } catch (error) {
                    console.log(error);
                }
            })
            .on(AudioPlayerStatus.Paused, async() => {
                try {
                    queue.playing = false;
                    await queue.save();
                } catch (error) {
                    console.log(error);
                }
            })
            .on(AudioPlayerStatus.Idle, () => endedHandler(guild_id, client).catch(console.log))
            .on("error", () => endedHandler(guild_id, client).catch(console.log));
        client.players[guild_id] = player;
    }
    client.players[guild_id].play(resource);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        if(!connection.state.subscription) connection.subscribe(client.players[guild_id]);
    } catch (error) {
        endedHandler(guild_id, client).catch(console.log);
        return;
    }

    try {
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
        let channel = client.channels.cache.get(song.textChannelId);
        if(queue.loop === 2) {
            let msgs = await channel.messages.fetch();
            let msg = msgs.get(queue.message_id);
            if(msg) message = msg;
            else message = await channel.send({ embeds: [embed], components: [action] });
        }
        else message = await channel.send({ embeds: [embed], components: [action] });
        queue.message_id = message.id;
        await queue.save();
    } catch (error) {
        console.log(error);
    }

}

/**
 * 
 * @param {string} guild_id 
 * @param {import("./client")} client 
 */
async function endedHandler(guild_id, client) {

    let queue = null;
    try {
        queue = await Queue.findOne({ guild_id });
    } catch (error) {
        console.log(error);
    }
    if(queue) {
        queue.votes = [];
        if(queue.loop === 0 || queue.loop === 1) {
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
            if(queue.loop === 1 && queue.index === (queue.songs.length - 1)) queue.index = 0;
            else queue.index++;
        }
        try {
            await queue.save();
            await play(queue.songs[queue.index], guild_id, client);
        } catch (error) {
            console.log(error);
        }
    }

}


module.exports = play;