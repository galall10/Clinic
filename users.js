const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const scheduleSchema = new Schema({
    time: String,
    date: String,
    docID: { type: Schema.Types.ObjectId, ref: 'doctors' },
});

const usersSchema = new Schema({
    userID: Number,
    useremail: String,
    userpass: Number,
    userappointments: [scheduleSchema],
});
usersSchema.virtual('userId').get(function () {
    return this._id;
});


const users = mongoose.model("users", usersSchema);

module.exports = users;