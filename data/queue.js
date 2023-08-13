const mongoose = require("mongoose");
const schema = new mongoose.Schema({
    guild_id: mongoose.SchemaTypes.String,
    channel_id: mongoose.SchemaTypes.String,
    message_id: mongoose.SchemaTypes.String,
    shuffle: mongoose.SchemaTypes.Boolean,
    loop: mongoose.SchemaTypes.Number,
    index: mongoose.SchemaTypes.Number,
    volume: mongoose.SchemaTypes.Number,
    dj_user_id: mongoose.SchemaTypes.String,
    playing: mongoose.SchemaTypes.Boolean,
    songs: [],
    votes: []
});

module.exports = mongoose.model("queue", schema);