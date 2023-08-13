const { getVoiceConnection, createAudioResource } = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");
const { stream: playdl } = require("play-dl");
const { Queue } = require("../data");
const options = [
    {
        name: "hours",
        description: "Hours of the duration (type 0 if the song doesn't reach an hour)",
        type: 4,
        required: true
    },
    {
        name: "minutes",
        description: "Minutes of the duration (type 0 if the song doesn't reach a minute)",
        type: 4,
        required: true
    },
    {
        name: "seconds",
        description: "Seconds of the duration",
        type: 4,
        required: true
    }
];

module.exports = {
    data: [
        {
            name: "seek",
            description: "Seek duration of the song.",
            options: options
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
        if(!channel) {
            try {
                await interaction.reply({
                    content: "You need to join voice channel first!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

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

        let currentSong = queue.songs[queue.index];
        let hours = interaction.options.get("hours", true).value;
        let minutes = interaction.options.get("minutes", true).value;
        let seconds = interaction.options.get("seconds", true).value;

        hours = hours*3600*1000;
        minutes = minutes*60*1000;
        seconds = seconds*1000;

        let totalSeekDuration = hours+minutes+seconds;
        let totalDuration = currentSong.duration;
        if(totalSeekDuration > totalDuration) {
            try {
                await interaction.reply({
                    content: `Current song duration is: ${client.parseMsToFormat(totalDuration)}`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let data = null;
        try {
            if(currentSong.type === "youtube") data = await playdl(currentSong.url, { seek: totalSeekDuration / 1000 });
            else if(currentSong.type === "spotify") data = await playdl(currentSong.youtube_url, { seek: totalSeekDuration / 1000 });
            else if(currentSong.type === "soundcloud") {
                await interaction.reply({
                    content: "Bot cannot seek soundcloud track at the moment!",
                    ephemeral: true
                });
                return;
            }
        } catch (error) {
            console.log(error);
        }
        if(!data) {
            try {
                await interaction.reply({
                    content: "There's something wrong while try to seek current track!",
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let resource = createAudioResource(data.stream, { inlineVolume: true, inputType: data.type });
        resource.volume.setVolume(queue.volume / 100);
        client.players[interaction.guildId].play(resource);

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: `| Seek to: ${client.parseMsToFormat(totalSeekDuration)}`, iconURL: client.user.displayAvatarURL() });
        try {
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }
        return;

    }
}