const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { getVoiceConnection, joinVoiceChannel } = require("@discordjs/voice");
const { search } = require("scrape-youtube");
const { Queue } = require("../data");
const { play } = require("../src");
const ytdl = require("ytdl-core");
const options = [
    {
        name: "query",
        description: "Input a query",
        type: 3,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "search",
            description: "Search for a song.",
            options: options
        },
        {
            name: "sc",
            description: "Search for a song.",
            options: options
        },
        {
            name: "src",
            description: "Search for a song.",
            options: options
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {
        
        let { channel } = interaction.member.voice;
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
        
        let connection = getVoiceConnection(interaction.guildId);
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

        let query = interaction.options.get("query", true).value;
        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: "| Search for a song", iconURL: client.user.displayAvatarURL() })
            .setDescription(`Results of: [${query}](https://www.youtube.com/results?search_query=${query.split(" ").join("+")})`);

        let actionRow = new ActionRowBuilder();
        let controlRow = new ActionRowBuilder();
        controlRow.setComponents([
            new ButtonBuilder()
                .setCustomId("random")
                .setLabel("Random")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        ]);

        let videos = null;
        try {
            let results = await search(query);
            videos = results.videos;
        } catch (error) {
            console.log(error);
        }
        if(!videos || !videos.length) {
            try {
                await interaction.reply({
                    content: "Cannot find songs! Please Try again.",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        for (let i = 0; i < videos.splice(0, 5).length; i++) {
            let video = videos[i];
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(video.id)
                    .setLabel(`${i+1}`)
                    .setStyle(ButtonStyle.Success)
            );
            embed.addFields(
                {
                    name: `${i+1}). ${video.title}`,
                    value: `${video.channel.name}`
                }
            );
        }

        let msg = null;
        let response = null;
        try {
            msg = await interaction.reply({
                embeds: [embed],
                components: [actionRow, controlRow],
                fetchReply: true
            });
            response = await msg.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id
            });
        } catch (error) {
            console.log(error);
        }
        if(!response) {
            try {
                await msg.delete();
            } catch (error) {
                console.log(error);
            }
            return;
        }

        if(response.customId === "cancel") {
            try {
                await response.message.delete();
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let songInfo = null;
        try {
            if(response.customId === "random") songInfo = await ytdl.getInfo(videos[Math.floor(Math.random()*videos.length)].link);
            else {
                let index = videos.map(i => i.id).indexOf(response.customId);
                songInfo = await ytdl.getInfo(videos[index].link);
            }
        } catch (error) {
            console.log(error);
        }

        if(!songInfo) {
            try {
                await response.update({
                    content: "Something wrong while trying to fetch song information!",
                    embeds: [],
                    components: []
                });
                setTimeout(async() => {
                    try {
                        await response.message.delete();
                    } catch (error) {
                        console.log(error);
                    }
                }, 5000);
            } catch (error) {
                console.log(error);
            }
            return;
        }
        let serverQueue = null;
        let queueConstruct = {
            guild_id: interaction.guildId,
            channel_id: channel.id,
            message_id: null,
            shuffle: false,
            loop: 0,
            index: 0,
            volume: 100,
            dj_user_id: interaction.user.id,
            playing: true,
            songs: [],
            votes: []
        }
        try {
            serverQueue = await Queue.findOne({ guild_id: interaction.guildId });
        } catch (error) {
            console.log(error);
        }

        let song = {
            title: songInfo.videoDetails.title,
            id: generateID(10),
            trackId: songInfo.videoDetails.videoId,
            url: songInfo.videoDetails.video_url,
            thumbnails: songInfo.videoDetails.thumbnails,
            duration: songInfo.videoDetails.lengthSeconds*1000,
            channel: songInfo.videoDetails.author,
            type: "youtube",
            textChannelId: interaction.channelId,
            requestedUserId: interaction.user.id,
            index: serverQueue ? serverQueue.songs.length : queueConstruct.songs.length
        }

        if(serverQueue) serverQueue.songs.push(song);
        else queueConstruct.songs.push(song);

        if(serverQueue && serverQueue.shuffle) {
            let currentSong = serverQueue.songs[serverQueue.index];
            serverQueue.songs = client.shuffleArray(serverQueue.songs);

            let index = serverQueue.songs.map(i => i.id).indexOf(currentSong.id);
            serverQueue.index = index;
        }
        embed
            .setAuthor({ name: `| Added song to queue`, iconURL: client.user.displayAvatarURL() })
            .setDescription(`[${song.title}](${song.url}) - [<@${song.requestedUserId}>]`)
            .setFields([]);
        try {
            if(serverQueue) await serverQueue.save();
            else await Queue.create(queueConstruct);
            await response.update({
                embeds: [embed],
                content: null,
                components: []
            });
        } catch (error) {
            console.log(error);
        }

        if(!serverQueue) {
            try {
                if(!connection) {
                    connection = joinVoiceChannel({
                        guildId: interaction.guildId,
                        channelId: channel.id,
                        adapterCreator: interaction.guild.voiceAdapterCreator
                    });
        
                    const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
                        const newUdp = Reflect.get(newNetworkState, 'udp');
                        clearInterval(newUdp?.keepAliveInterval);
                    }
                      
                      connection.on('stateChange', (oldState, newState) => {
                        const oldNetworking = Reflect.get(oldState, 'networking');
                        const newNetworking = Reflect.get(newState, 'networking');
                      
                        oldNetworking?.off('stateChange', networkStateChangeHandler);
                        newNetworking?.on('stateChange', networkStateChangeHandler);
                    });
                }
                await play(queueConstruct.songs[0], interaction.guildId, client);
            } catch (error) {
                console.log(error);
                connection.destroy();
            }
        }

    }
}

/**
 * 
 * @param {number} length 
 */
function generateID(length) {
    let string = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    for (let i = 0; i < length; i++) {
        string += characters[Math.floor(Math.random()*characters.length)];
    }
    return string;
} 