const { Queue } = require("../data");
const { EmbedBuilder } = require("discord.js");
const options = [
    {
        name: "select-song",
        description: "Select song with number (check on queue).",
        type: 4,
        required: true
    }
]

module.exports = {
    data: [
        {
            name: "remove",
            description: "Remove a song from queue.",
            options: options
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

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

        let selectedIndex = interaction.options.get("select-song", true).value;
        if(selectedIndex < 1 || selectedIndex > queue.songs.length) {
            try {
                await interaction.reply({
                    content: `You can only input ${queue.songs.length > 1 ? `between 1 and ${queue.songs.length}` : "1"} number(s)`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        let confirm = false;
        let member = interaction.member;
        let currentSong = queue.songs[queue.index];
        let selectedSong = queue.songs[selectedIndex - 1];

        for (let i = 0; i < member.roles.cache.size; i++) {
            let role = member.roles.cache.toJSON()[i];
            let permissions = parseInt(role.permissions.bitfield.toString());
            for (let i = 0; i < client.permissions.length; i++) {
                if((permissions & client.permissions[i]) === client.permissions[i]) confirm = true;
            }
        }

        if(queue.dj_user_id === member.user.id) confirm = true;
        if(currentSong.requestedUserId === member.user.id) confirm = true;
        if(!confirm) {
            try {
                await interaction.reply({
                    content: `You cannot remove [${selectedSong.title}](<${selectedSong.url}>)!`,
                    ephemeral: true
                });
            } catch (error) {
                console.log(error);
            }
            return;
        }

        queue.songs.splice(selectedIndex - 1, 1);
        if(queue.index === (selectedIndex - 1)) {
            queue.index -= 2;
            client.players[interaction.guildId].stop();
        }

        queue.songs = queue.songs.map((song, index) => {
            song.index = index;
            return song;
        });

        let index = queue.songs.map(i => i.id).indexOf(currentSong.id);
        queue.index = index;

        let embed = new EmbedBuilder()
            .setColor(client.config.defaultColor)
            .setAuthor({ name: `| Removed song from queue!`, iconURL: client.user.displayAvatarURL({ size: 1024 }) })
            .setDescription(`[${selectedSong.title}](${selectedSong.url}) - [<@${selectedSong.requestedUser.id}>]`);
        try {
            await queue.save();
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            
        }

    }
}