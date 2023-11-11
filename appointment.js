const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const scheduleSchema
    =new Schema({
    userID: { type: Schema.Types.ObjectId, ref: 'User' },
    docID: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    times: String,
    dates:Date,

});
scheduleSchema.virtual('appointmentId').get(function () {
    return this._id;
});

const appointment = mongoose.model("appointment", scheduleSchema);

module.exports = appointment;