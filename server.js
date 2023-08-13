require("dotenv").config();
const { Client, starboard, handle } = require("./src");
const { REST, Routes, Events, ActivityType, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
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
    
    let queue = client.queue.get(oldState.guild.id);
    let connection = getVoiceConnection(oldState.guild.id);
    if(!connection) {
        if(queue) client.queue.delete(oldState.guild.id);
        return;
    }
    if(!queue) return;
    
    let { member, channel } = newState;
    let clientVoiceChannel = client.channels.cache.get(channel ? channel.id : oldState.channelId);
    if(!clientVoiceChannel || !clientVoiceChannel.isVoiceBased()) return;
    
    let members = clientVoiceChannel.members.filter(m => !m.user.bot && m.user.id !== client.user.id).toJSON();
    if(!channel) {
        if(member.user.id === client.user.id) {
            connection.destroy();
            queue.message.delete().catch(console.log);
            client.queue.delete(oldState.guild.id);
        }
        if(member.user.id === queue.dj_user.id) {
            if(members && members.length) queue.dj_user = members[Math.floor(Math.random()*members.length)].user;
            else {
                let actionRow = modifyComponent(queue);
                queue.dj_user = null;
                queue.message.edit({ components: [actionRow] }).catch(console.log);
            }
        }
    }
    else {
        if(member.user.id === client.user.id) {
            if(members.length >= 1) queue.dj_user = members[Math.floor(Math.random()*members.length)].user;
            else {
                let actionRow = modifyComponent(queue);
                queue.dj_user = null;
                queue.message.edit({ components: [actionRow] }).catch(console.log);
            }
        }
        else {
            if(channel.id === connection.joinConfig.channelId) {
                if(members.length === 1) queue.dj_user = member.user;
            }
            else {
                if(queue.dj_user && (member.user.id === queue.dj_user.id)) {
                    if(members.length) queue.dj_user = members[Math.floor(Math.random()*members.length)].user;
                    else {
                        let actionRow = modifyComponent(queue);
                        queue.dj_user = null;
                        queue.message.edit({ components: [actionRow] }).catch(console.log);
                    }
                }
            }
        }
    }
});

function modifyComponent(queue) {
    let actionRow = new ActionRowBuilder();
    let actions = queue.message.components[0];
    for (let i = 0; i < actions.components.length; i++) {
        let component = actions.components[i];
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(component.customId)
                .setEmoji(component.customId === "player" ? "▶️" : component.emoji)
                .setStyle(component.style)
        );
    }
    queue.player.pause();
    return actionRow;
}