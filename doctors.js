const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const scheduleSchema = new Schema({
    time: String,
    date: String,
});

const docSchema = new Schema({
    docID: Number,
    docemail: String,
    docpass: Number,
    specialty: String,
    availableSlots: [scheduleSchema],
});
docSchema.virtual('doctorId').get(function () {
    return this._id;
});

const doctors = mongoose.model("doctors", docSchema);

module.exports = doctors;