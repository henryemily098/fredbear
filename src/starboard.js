const { Starboard } = require("../data");
const { EmbedBuilder } = require("discord.js");
const ytdl = require("ytdl-core");

/**
 * 
 * @param {import('discord.js').MessageReaction} reaction 
 * @param {import('discord.js').User} user
 * @param {import('./client')} client 
 */
module.exports.add = async(reaction, user, client) => {

    let channel = reaction.message.guild.channels.cache.get("820205164181979156");
    let counts = reaction.message.reactions.cache.filter(react => react.message.author.id !== user.id && react.emoji.name === "⭐").size;
    let data = null;
    try {
        data = await Starboard.findOne({ guildId: reaction.message.guild.id, messageId: reaction.message.id });
    } catch (error) {
        console.log(error);
    }

    if(!channel || !channel.isTextBased()) return;
    if(!counts < 5) return;
    if(counts < 5 && data) {
        let msgs = await channel.messages.fetch();
        let msg = msgs.get(data.messageStarboardId);
        if(msg) msg.delete().catch(console.log);
        try {
            await Starboard.findOneAndDelete({ guildId: reaction.message.guild.id, messageId: reaction.message.id });
        } catch (error) {
            console.log(error);
        }
        return;
    }

    if(data) {

        let msgs = await channel.messages.fetch();
        let msg = msgs.get(data.messageStarboardId);
        if(msg) msg.edit({ content: `**💫${counts} │ <#${reaction.message.channel.id}>**` }).catch(console.log);
        else {
            
            let message = null;
            try {
                message = await createMessage(reaction, channel, client, counts);
            } catch (error) {
                console.log(error);
            }

            data.messageStarboardId = message?.id || "";
        }

    }
    else {

        let message = null;
        try {
            message = await createMessage(reaction, channel, client, counts);
        } catch (error) {
            console.log(error);
        }

        data = new Starboard({
            guildId: reaction.message.guildId,
            messageId: reaction.message.id,
            messageStarboardId: message?.id || ""
        });

    }

    try {
        await data.save();
    } catch (error) {
        console.log(error);
    }
}

/**
 * 
 * @param {import('discord.js').MessageReaction} reaction 
 * @param {import('discord.js').User} user
 * @param {import('./client')} client 
 */
module.exports.remove = async(reaction, user,client) => {

    let channel = reaction.message.guild.channels.cache.get("820205164181979156");
    let counts = reaction.message.reactions.cache.filter(react => react.message.author.id !== user.id && react.emoji.name === "⭐").size;
    let data = null;
    try {
        data = await Starboard.findOne({ guildId: reaction.message.guild.id, messageId: reaction.message.id });
    } catch (error) {
        console.log(error);
    }
    if(!data || !data.messageStarboardId.length) return;
    if(!channel || !channel.isTextBased()) return;

    let msgs = await channel.messages.fetch();
    let msg = msgs.get(data.messageStarboardId);
    if(msg) {
        if(counts < 5) {
            try {
                await Starboard.findOneAndDelete({ guildId: reaction.message.guild.id, messageId: reaction.message.id })
            } catch (error) {
                console.log(error);
            }
            msg.delete().catch(console.log);
        }
        else msg.edit({ content: `**💫${counts} │ <#${reaction.message.channel.id}>**` }).catch(console.log);
    }
    else {
        if(counts < 5) {
            try {
                await Starboard.findOneAndDelete({ guildId: reaction.message.guild.id, messageId: reaction.message.id })
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let message = null;
        try {
            message = await createMessage(reaction, channel, client, counts);
        } catch (error) {
            console.log(error);
        }

        data.messageStarboardId = message?.id || "";
        try {
            await data.save();
        } catch (error) {
            console.log(error);
        }
    }

}

/**
 * 
 * @param {import("discord.js").MessageReaction} reaction 
 * @param {import("discord.js").TextChannel} channel
 * @param {import("../src").client} client 
 * @param {number} counts
 */
async function createMessage(reaction, channel, client, counts) {

    let { content, attachments } = reaction.message;
    let embed = new EmbedBuilder()
        .setColor(client.config.defaultColor)
        .setAuthor({ name: `│ ${reaction.message.author.tag}`, iconURL: reaction.message.author.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) })
        .setTimestamp(Date.now());
    
    let files = [];
    let attachment = extension(attachments.size ? attachments.first().url : "");
    if(!attachment && attachments.size) files.push(reaction.message.attachments.first().attachment);
    
    let url = null;
    let split = content.split(" ");

    let regexUrl = /^(ftp|http|https):\/\/[^ "]+$/;
    let regex = {
        video: /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/gi,
        playlist: /^.*(list=)([^#\&\?]*).*/gi
    }

    for (let i = 0; i < split.length; i++) {
        if(regexUrl.test(split[i])) {
            if(regex.video.test(split[i]) && !regex.video.test(split[i])) url = { isYoutube: true, value: split[i] }
            else url = { isYoutube: false, value: split[i] };
            break;
        }
    }

    embed.setImage(attachment);
    if(url && url.isYoutube) {
        let video = null;
        try {
            video = await ytdl.getInfo(url.value);
        } catch (error) {
            console.log(error);
        }

        let description = video ? (video.videoDetails.description.length > 256 ? video.videoDetails.description.substring(0, 253)+"..." : video.videoDetails.description) : null;
        embed
            .setColor("#ff0000")
            .setTitle(video ? video.videoDetails.title : null)
            .setURL(video ? video.videoDetails.video_url : null)
            .setDescription(
                content.length > 256 ? content.substring(0, 253)+"..." : content+`\n\n${description ? `${description}\n\n` : ""}`+`[Jump to Message](${reaction.message.url})`
            )
            .setThumbnail(attachment ? null : video?.videoDetails.thumbnails.sort((b, a) => b.height - a.height)[0].url.split("?")[0])
            .setImage(attachment);
    }
    else {
        embed.setDescription(
            content.length > 256 ? content.substring(0, 253)+"..." : content+"\n\n"+`[Jump to Message](${reaction.message.url})`
        );
    }

    let message = null;
    try {
        message = await channel.send({ content: `**💫${counts} │ <#${reaction.message.channelId}>**`, embeds: [embed] });
    } catch (error) {
        console.log(error);
    }

    return message;
}

/**
 * 
 * @param {string} attachment 
 */
function extension(attachment) {
    const imageLink = attachment.split('.');
    const typeOfImage = imageLink[imageLink.length - 1];
    const image = /(jpg|jpeg|png|gif)/gi.test(typeOfImage);
    if(!image) return null;
    else return attachment
}