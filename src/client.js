const { Client, Collection, Partials } = require("discord.js");

module.exports = class extends Client {
    constructor() {
        super({
            partials: [
                Partials.Channel, Partials.GuildMember, Partials.GuildScheduledEvent, Partials.Message,
                Partials.Reaction, Partials.ThreadMember, Partials.User
            ],
            intents: [
                "AutoModerationConfiguration", "AutoModerationExecution", "DirectMessageReactions", "DirectMessageTyping", "DirectMessages", "GuildBans", "GuildEmojisAndStickers",
                "GuildIntegrations", "GuildInvites", "GuildMembers", "GuildMessageReactions", "GuildMessageTyping", "GuildMessages", "GuildPresences", "GuildScheduledEvents", "GuildVoiceStates", "GuildWebhooks",
                "Guilds", "MessageContent"
            ]
        });

        this.players = {};
        this.cooldown = new Map();
        this.commands = new Collection();
        this.config = require("./config.json");
        this.permissions = [
            0x8, 0x4, 0x20, 0x2, 0x10000000, 0x10
        ];
    }

    /**
     * 
     * @param {number} duration 
     * @returns 
     */
    parseMsToFormat(duration) {
        let seconds = Math.floor((duration / 1000) % 60);
        let minutes = Math.floor((duration / 1000 / 60) % 60);
        let hours = Math.floor((duration / 1000 / 60 / 60) % 24);

        const formattedTime = [
            hours.toString().padStart(2, "0"),
            minutes.toString().padStart(2, "0"),
            seconds.toString().padStart(2, "0")
        ].join(":");

        return formattedTime;
    }

    /**
     * @param {Array} array 
     * @returns returns as new array contents
     */
    shuffleArray(array) {
        var currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    /**
     * 
     * @param {string} token 
     */
    setToken(token) {
        this.login(token).catch(console.log);
        return this;
    }
}