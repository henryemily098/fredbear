require("dotenv").config();
const { Client, starboard, handle, play, endedHandle } = require("./src");
const { REST, Routes, Events, ActivityType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const { Queue } = require("./data");
const { App } = require("./api");

const fs = require("fs");
const mongoose = require("mongoose");
const { interactionButtonHandle, interactionCommandHandle } = handle;

const client = new Client().setToken(process.env.TOKEN);
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
const app = new App();

let commands = [];
let files = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
for (let i = 0; i < files.length; i++) {
    const command = require(`./commands/${files[i]}`);
    if(command) {
        if(command.data) {
            for (let i = 0; i < command.data.length; i++) {
                let app = command.data[i];
                client.commands.set(app.name, command);
                commands.push(app);
            }
        }
    }
}

mongoose.set('strictQuery', true);
mongoose
.connect(`mongodb+srv://fredbear:${process.env.MONGODB_PWD}@cluster0.yjszp3f.mongodb.net/?retryWrites=true&w=majority`)
.catch(console.log);

let listening = app.listen(process.env.PORT || 3000, () => console.log(`> Listening to port: ${listening.address().port}`));
app.get("*", (req, res) => {
  res.send("Ready!")
});

(async() => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } catch (error) {
        console.log(error);
    }
})();

client.on(Events.ClientReady, () => {
    console.log(`> ${client.user.tag} it's ready!`);
    setTimeout(() => {
        checkQueue().catch(console.log);
    }, 5000);
    client.user.setPresence({
        status: "dnd",
        activities: [{ name: "Your Nightmare...", type: ActivityType.Watching }]
    });
});
client.on(Events.InteractionCreate, async(interaction) => {
    if(interaction.isCommand()) await interactionCommandHandle(interaction);
    if(interaction.isButton()) await interactionButtonHandle(interaction);
});
client.on(Events.MessageReactionAdd, async(reaction, user) => {

    if(!reaction.message.inGuild() || reaction.message.guild.id !== "706744372326039573") return;
    if(reaction.emoji.name === "⭐") {
        try {
            await reaction.message.fetch();
            await reaction.fetch();
        } catch (error) {
            console.log(error);
            return;
        }

        if(user.bot) return;
        if(reaction.message.author.bot) return;
        if(reaction.message.author.id === user.id) return;

        return starboard.add(reaction, user, client).catch(console.log);
    }

});
client.on(Events.MessageReactionRemove, async(reaction, user) => {

    if(!reaction.message.inGuild() || reaction.message.guild.id !== "706744372326039573") return;
    if(reaction.emoji.name === "⭐") {
        try {
            await reaction.message.fetch();
            await reaction.fetch();
        } catch (error) {
            console.log(error);
            return;
        }

        if(user.bot) return;
        if(reaction.message.author.bot) return;
        if(reaction.message.author.id === user.id) return;

        return starboard.remove(reaction, user, client).catch(console.log);
    }

});
client.on(Events.VoiceStateUpdate, async(oldState, newState) => {
    if(!oldState.guild && !newState.guild) return;
    
    let queue = null;
    let connection = getVoiceConnection(oldState.guild.id);
    try {
        queue = await Queue.findOne({ guild_id: oldState.guild.id });
    } catch (error) {
        console.log(error);
    }
    if(!connection) {
        if(queue) {
            try {
                await queue.deleteOne();
            } catch (error) {
                console.log(error);
            }
        }
        return;
    }
    if(!queue) return;
    
    let { member, channel } = newState;
    let clientVoiceChannel = client.channels.cache.get(channel ? channel.id : oldState.channelId);
    if(!clientVoiceChannel || !clientVoiceChannel.isVoiceBased()) return;
    
    let members = clientVoiceChannel.members.filter(m => !m.user.bot && m.user.id !== client.user.id);
    if(!channel) {
        if(member.user.id === client.user.id) {
            connection.destroy();
            try {
                let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                let messages = await channel.messages.fetch();
                let message = messages.get(queue.message_id);
                if(message) await message.delete();
                await queue.deleteOne();
            } catch (error) {
                console.log(error);
            }
        }
        if(member.user.id === queue.dj_user_id) {
            if(members && members.size) queue.dj_user_id = members.at(Math.floor(Math.random()*members.size)).user.id;
            else {
                let actionRow = null;
                try {
                    actionRow = await modifyComponent(queue);
                } catch (error) {
                    console.log(error)
                }
                queue.dj_user_id = null;
                
                try {
                    let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                    let messages = await channel.messages.fetch();
                    let message = messages.get(queue.message_id);
                    if(message) await message.edit({ components: [actionRow] })
                    await queue.save();
                } catch (error) {
                    console.log(error);
                }
            }
        }
    }
    else {
        if(member.user.id === client.user.id) {
            queue.channel_id = channel.id;
            if(members.size >= 1) queue.dj_user_id = members.at(Math.floor(Math.random()*members.length)).user.id;
            else {
                let actionRow = null;
                try {
                    actionRow = await modifyComponent(queue);
                } catch (error) {
                    console.log(error)
                }
                queue.dj_user_id = null;
                
                try {
                    let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                    let messages = await channel.messages.fetch();
                    let message = messages.get(queue.message_id);
                    if(message) await message.edit({ components: [actionRow] });
                } catch (error) {
                    console.log(error);
                }
            }
            try {
                await queue.save();
            } catch (error) {
                console.log(error);
            }
        }
        else {
            if(channel.id === connection.joinConfig.channelId) {
                if(members.size === 1) queue.dj_user_id = member.user.id;
            }
            else {
                if(member.user.id === queue.dj_user_id) {
                    if(members.size) queue.dj_user_id = members.at(Math.floor(Math.random()*members.size)).user.id;
                    else {
                        let actionRow = null;
                        try {
                            actionRow = await modifyComponent(queue);
                        } catch (error) {
                            console.log(error)
                        }
                        queue.dj_user_id = null;

                        try {
                            let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                            let messages = await channel.messages.fetch();
                            let message = messages.get(queue.message_id);
                            if(message) await message.edit({ components: [actionRow] })
                        } catch (error) {
                            console.log(error);
                        }
                    }
                }
            }
            try {
                await queue.save();
            } catch (error) {
                
            }
        }
    }
});

async function modifyComponent(queue) {
    let actionRow = new ActionRowBuilder();
    let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
    let messages = await channel.messages.fetch();
    let message = messages.get(queue.message_id);

    let actions = message.components[0];
    for (let i = 0; i < actions.components.length; i++) {
        let component = actions.components[i];
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(component.customId)
                .setEmoji(component.customId === "song_player" ? "▶️" : component.emoji)
                .setStyle(component.style)
        );
    }
    client.players[queue.guild_id].pause();
    return actionRow;
}

async function checkQueue() {
    let data = null;
    try {
        data = await Queue.find();
    } catch (error) {
        console.log(error);
    }
    data.forEach(async queue => {
        let connection = getVoiceConnection(queue.guild_id);
        if(!connection) {
            try {
                let guild = client.guilds.cache.get(queue.guild_id);
                let channel = client.channels.cache.get(queue.songs[queue.index].textChannelId);
                let messages = await channel.messages.fetch();
                let message = messages.get(queue.message_id);
                if(message) await message.delete();

                connection = joinVoiceChannel({
                    guildId: queue.guild_id,
                    channelId: queue.channel_id,
                    adapterCreator: guild.voiceAdapterCreator
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
                
                let voiceChannel = client.channels.cache.get(queue.channel_id);
                if(!voiceChannel) {
                    try {
                        connection.destroy();
                        await queue.deleteOne();
                    } catch (error) {
                        console.log(error);
                    }
                    return;
                }

                let members = voiceChannel.members.filter(m => !m.user.bot);
                if(members.size) await play(queue.songs[queue.index], queue.guild_id, client);
                else {
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
                        .on(AudioPlayerStatus.Idle, () => endedHandler(queue.guild_id, client).catch(console.log))
                        .on("error", () => endedHandle(queue.guild_id, client).catch(console.log));
                    client.players[queue.guild_id] = player;

                    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
                    if(!connection.state.subscription) connection.subscribe(client.players[queue.guild_id]);

                    let song = queue.songs[queue.index];
                    let embed = new EmbedBuilder()
                        .setColor(client.config.defaultColor)
                        .setAuthor({ name: "| Now Playing", iconURL: client.user.displayAvatarURL({ size: 1024 }) })
                        .setDescription(`[${song.title}](${song.url}) - [<@${song.requestedUserId}>]`);
            
                    let action = new ActionRowBuilder()
                        .setComponents([
                            new ButtonBuilder()
                                .setCustomId("song_player")
                                .setEmoji("▶")
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
                        message = await channel.send({
                            embeds: [embed],
                            components: [action]
                        });
                    } catch (error) {
                        console.log(error);
                    }

                    queue.playing = false;
                    queue.message_id = message?.id;
                    await queue.save();
                }
            } catch (error) {
                console.log(error);
                connection.destroy();
            }
        }
    });
}