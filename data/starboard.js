const mongoose = require("mongoose");
const schema = new mongoose.Schema({
    guildId: mongoose.SchemaTypes.String,
    messageId: mongoose.SchemaTypes.String,
    messageStarboardId: mongoose.SchemaTypes.String
});

module.exports = mongoose.model("starboard", schema);