const { EmbedBuilder } = require("discord.js");
const { getVoiceConnection, joinVoiceChannel } = require("@discordjs/voice");
const { Spotify } = require("spotify-info.js");
const { Queue } = require("../data");
const { play } = require("../src");

const fetch = require('node-fetch').default;
const scrape = require("scrape-youtube").search;
const scdl = require("soundcloud-downloader").default;
const ytdl = require("ytdl-core");
const spotify = new Spotify({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});
const options = [
    {
        name: "query",
        type: 3,
        required: true,
        description: "Input a query to search a song."
    }
]

module.exports = {
    data: [
        {
            name: "play",
            description: "Playing song with Nightmare Fredbear",
            options: options
        },
        {
            name: "p",
            description: "Playing song with Nightmare Fredbear",
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
                    content: "You need  to join voice channel first!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let connection = getVoiceConnection(interaction.guild.id);
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
        let soundcloudMobileRegex = /^https?:\/\/(on\.soundcloud\.com)\/(.*)$/;
        let url = query.split(" ")[0];

        if(soundcloudMobileRegex.test(url)) {
            let response = await fetch(url);
            url = response.url;
        }
        
        let data = getData(url);
        let track = null;
        let tracks = [];

        // title, id, trackId, url, thumbnail, duration, type
        try {

            if(data) {
                if(data.platform === "youtube") {
                    if(data.type === "video") {
                        let trackInfo = await ytdl.getInfo(url);
                        track = {
                            title: trackInfo.videoDetails.title,
                            id: generateID(10),
                            trackId: trackInfo.videoDetails.videoId,
                            url: trackInfo.videoDetails.video_url,
                            thumbnails: trackInfo.videoDetails.thumbnails,
                            duration: trackInfo.videoDetails.lengthSeconds*1000,
                            channel: trackInfo.videoDetails.author,
                            type: "youtube"
                        }
                    }
                    else if(data.type === "playlist") tracks = await getPlaylistItems(url);
                }
                else if(data.platform === "spotify") {
                    if(data.type !== "track") {
                        let info = null;
                        if(data.type === "playlist") info = await spotify.getPlaylistByURL(url);
                        if(data.type === "album") info = await spotify.getAlbumByURL(url);

                        tracks = info.tracks.items.map(item => {
                            let trackInfo = null;
                            if(data.type === "playlist") trackInfo = item.track;
                            if(data.type === "album") trackInfo = item;

                            return {
                                title: `${trackInfo.name}`,
                                id: generateID(10),
                                trackId: trackInfo.id,
                                url: `https://open.spotify.com/track/${trackInfo.id}`,
                                thumbnails: data.type === "playlist" ? trackInfo.album.images : trackInfo.images,
                                duration: parseInt(trackInfo.duration_ms),
                                artists: trackInfo.artists,
                                type: "spotify"
                            }
                        });
                    }
                    else {
                        let songInfo = await spotify.getTrackByURL(url);
                        track = {
                            title: `${songInfo.name}`,
                            id: generateID(10),
                            trackId: songInfo.id,
                            url: `https://open.spotify.com/track/${songInfo.id}`,
                            thumbnails: songInfo.album.images,
                            duration: parseInt(songInfo.duration_ms),
                            artists: songInfo.artists,
                            type: "spotify"
                        }
                    }
                }
                else if(data.platform === "soundcloud") {
                    if(data.type === "playlist") {
                        let setsInfo = await scdl.getSetInfo(url);
                        tracks = setsInfo.tracks.map(track => {
                            return {
                                title: track.title,
                                id: generateID(10),
                                trackId: `${track.id}`,
                                url: track.permalink_url,
                                thumbnails: track.artwork_url ? [
                                    {
                                        height: 500,
                                        width: 500,
                                        url: track.artwork_url
                                    }
                                ] : [],
                                duration: track.full_duration,
                                author: track.user,
                                type: "soundcloud"
                            }
                        });
                    }
                    else {
                        let songInfo = await scdl.getInfo(url);
                        track = {
                            title: songInfo.title,
                            id: generateID(10),
                            trackId: `${songInfo.id}`,
                            url: songInfo.permalink_url,
                            thumbnails: songInfo.artwork_url ? [
                                {
                                    height: 500,
                                    width: 500,
                                    url: songInfo.artwork_url
                                }
                            ] : [],
                            duration: songInfo.full_duration,
                            author: songInfo.user,
                            type: "soundcloud"
                        }
                    }
                }
            }
            else {
                let results = await scrape(query);
                let trackInfo = await ytdl.getInfo(results.videos[0].link);
                track = {
                    title: trackInfo.videoDetails.title,
                    id: generateID(10),
                    trackId: trackInfo.videoDetails.videoId,
                    url: trackInfo.videoDetails.video_url,
                    thumbnails: trackInfo.videoDetails.thumbnails,
                    duration: trackInfo.videoDetails.lengthSeconds*1000,
                    channel: trackInfo.videoDetails.author,
                    type: "youtube"
                }
            }

        } catch(error) {
            console.log(error);
        }
        if(!track && !tracks.length) {
            try {
                await interaction.reply({
                    content: "There's something error while fetch track information!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let embed = new EmbedBuilder().setColor(client.config.defaultColor);
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

        if(track) {
            track['textChannelId'] = interaction.channelId;
            track['requestedUserId'] = interaction.user.id;
            track['index'] = serverQueue ? serverQueue.songs.length : queueConstruct.songs.length;
            
            if(serverQueue) serverQueue.songs.push(track);
            else queueConstruct.songs.push(track);

            embed
                .setAuthor({ name: `| Added song to queue`, iconURL: client.user.displayAvatarURL({ size: 1024 }) })
                .setDescription(`[${track.title}](${track.url}) - [<@${track.requestedUserId}>]`);
        }
        else if(tracks.length) {
            for (let i = 0; i < tracks.length; i++) {
                tracks[i]['textChannelId'] = interaction.channelId;
                tracks[i]['requestedUserId'] = interaction.user.id;
                tracks[i]['index'] = serverQueue ? serverQueue.songs.length : queueConstruct.songs.length;

                if(serverQueue) serverQueue.songs.push(tracks[i]);
                else queueConstruct.songs.push(tracks[i]);
            }
            embed.setAuthor({ name: `| Added ${tracks.length} tracks from ${data.platform} to queue`, iconURL: client.user.displayAvatarURL({ size: 1024 }) });
        }

        if(serverQueue && serverQueue.shuffle) {
            let currentSong = serverQueue.songs[serverQueue.index];
            serverQueue.songs = client.shuffleArray(serverQueue.songs);

            let index = serverQueue.songs.map(i => i.id).indexOf(currentSong.id);
            serverQueue.index = index;
        }

        try {
            if(serverQueue) await serverQueue.save();
            else await Queue.create(queueConstruct);
            await interaction.reply({ embeds: [embed] });
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
 * @param {string} url 
 * @returns 
 */
function getData(url) {
    let data = {
        type: "",
        platform: "",
        url: url
    }
    let regex = {
        url: /^(ftp|http|https):\/\/[^ "]+$/,
        youtube: {
            video: /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/gi,
            playlist: /^.*(list=)([^#\&\?]*).*/gi
        },
        spotify: {
            track: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(track)\/.+$/gi,
            album: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(album)\/.+$/gi,
            playlist: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(playlist)\/.+$/gi
        },
        soundcloud: {
            track: /^https?:\/\/(soundcloud\.com)\/(.*)$/,
            sets: /^.*\/(sets)\/([^#\&\?]*).*/gi,
            mobile: /^https?:\/\/(on\.soundcloud\.com)\/(.*)$/
        }
    }

    if(regex.url.test(url)) {
        if(regex.youtube.video.test(url)) data = { type: "video", platform: "youtube", url: url };
        if(!regex.youtube.video.test(url) && regex.youtube.playlist.test(url)) data = { type: "playlist", platform: "youtube", url: url };
        
        if(regex.spotify.track.test(url)) data = { type: "track", platform: "spotify", url };
        if(regex.spotify.album.test(url)) data = { type: "album", platform: "spotify", url };
        if(regex.spotify.playlist.test(url)) data = { type: "playlist", platform: "spotify", url };
        if(regex.soundcloud.track.test(url)) {
            data.platform += "soundcloud";
            if(regex.soundcloud.sets.test(url)) data.type += "playlist";
            else data.type += "track";
        }
    } else data = null;

    return data;
}

/**
 * 
 * @param {string} url 
 * @returns 
 */
function parsePlaylistId(url) {
    var regExp = /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com)\/(playlist\?)(list=)([^#\&\?]*).+$/gi;
    if(regExp.test(url)) {
        var match = url.match(regExp);
        return (match && match[7].length == 11) ? match[7] : null;
    } else return url;
}

/**
 * 
 * @param {string} url 
 * @returns 
 */
async function getPlaylistItems(url) {
    let items = [];
    let authorizeUrl = `https://www.googleapis.com/youtube/v3/playlistItems?key=${process.env.YT_KEY}&playlistId=${id}&part=snippet&maxResults=15`;
    let id = parsePlaylistId(url);
    
    try {
        let response = await fetch(authorizeUrl).then(res => res.json());
        for (let i = 0; i < response.items.length; i++) {
            let item = response.items[i].snippet;
            let trackInfo = await ytdl.getInfo(`https://youtube.com/watch?v=${item.resourceId.videoId}`);
            items.push({
                title: trackInfo.videoDetails.title,
                id: generateID(10),
                trackId: trackInfo.videoDetails.videoId,
                url: trackInfo.videoDetails.video_url,
                thumbnails: trackInfo.videoDetails.thumbnails,
                duration: trackInfo.videoDetails.lengthSeconds*1000,
                type: "youtube"
            });
        }
    } catch (error) {
        console.log(error);
        items = [];
    }

    return items;
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