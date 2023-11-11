const express = require("express");
const mongoose = require('mongoose');
const setupRabbitMQ = require('./messaging');


const app = express();
const appointment = require('./models/appointment');
const users = require('./models/users');
const doctors = require('./models/doctors');
app.use(express.json());


app.listen(3000, () => {
    console.log("I am listening in port 3000");
});

mongoose.connect(
        "mongodb+srv://glgl:01007297030@clinic.kpg0p51.mongodb.net/?retryWrites=true&w=majority"
    )
    .then(() => {
        console.log("connected successfully");
    })
    .catch((error) => {
        console.log("error with connecting with the DB ", error);
    });
// mongodb+srv://glgl:<password>@clinic.kpg0p51.mongodb.net/?retryWrites=true&w=majority


app.post("/signin", async (req, res) =>{

    const newusers = new users();
    const email = req.body.useremail;
    const upass = req.body.userpass;
    newusers.email = email;
    newusers.userpass = upass;
    users.findOne({email,upass}).then((user) => {
        if (!user) {
            res.send('Invalid username or password');
        } else {
            res.send('login done');
        }
    })
        .catch((err) => {
            res.send('error');
        });
});
app.post("/signup", async (req, res) => {
    const newusers = new users();
    const uid = req.body.userID;
    const email = req.body.useremail;
    const upass = req.body.userpass;
    newusers.userID = uid;
    newusers.email = email;
    newusers.userpass = upass;

    await newusers.save();

    res.json(newusers);
});

// Endpoint for a doctor to set their schedule
app.post('/doctors/:doctorId/schedule', async (req, res) => {
    const pathdocid = req.params.doctorId;

    // Destructure the relevant data from the request body
    const { docID, docemail, time, date } = req.body;

    // Check if the provided 'pathdocid' in the URL matches 'docID' in the request body
    if (pathdocid == docID) {
        try {
            // Find the doctor in the database
            const doctor = await doctors.findById(pathdocid);

            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Assuming the doctor model has a field named 'availableSlots'
            doctor.availableSlots.push({ time, date });

            // Save the updated doctor information with the new slot
            await doctor.save();

            // You might want to return only the relevant information about the saved slot
            res.json({ message: 'Schedule updated successfully', slot: doctor.availableSlots.slice(-1)[0] });
        } catch (error) {
            console.error("Error while setting the schedule: ", error);
            return res.status(500).json({ error: 'Failed to set the schedule' });
        }
    } else {
        console.log("Error: Mismatch between 'pathdocid' in URL and 'docID' in the request body");
        return res.status(400).json({ error: "Mismatch between 'pathdocid' in URL and 'docID' in the request body" });
    }
});

// Endpoint for patients to choose a slot
app.post('/patients/:patientId/select_appointments', async (req, res) => {
    const patientId = req.params.patientId;
    const { doctorId, time, date } = req.body;

    try {
        // Check if the slot is available
        const doctor = await doctors.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        const isSlotAvailable = doctor.availableSlots.some((s) => s.time === time && s.date === date);
        if (!isSlotAvailable) {
            return res.status(400).json({ error: 'Selected slot is not available' });
        }

        // Book the slot for the patient
        const patient = await users.findById(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Create a new appointment using the Appointment model
        const newAppointment = new appointment({
            userID: patientId,
            docID: doctorId,
            times: time,
            dates: date,
        });

        // Save the new appointment to the database
        const savedAppointment = await newAppointment.save();

        // Remove the booked slot from the doctor's available slots
        doctor.availableSlots = doctor.availableSlots.filter((s) => !(s.time === time && s.date === date));
        await doctor.save();
        const channel = await setupRabbitMQ();
        const message = { doctorId, patientId, operation: 'ReservationCreated', appointment: savedAppointment };
        channel.publish('clinic_reservation', '', Buffer.from(JSON.stringify(message)));

        res.json({ message: 'Appointment booked successfully', appointment: savedAppointment });
    } catch (error) {
        console.error("Error while booking appointment: ", error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});


app.put('/patients/:patientId/change_appointments/:appointmentId', async (req, res) => {
    const patientId = req.params.patientId;
    const appointmentId = req.params.appointmentId;
    const { newDoctorId, newTime, newDate } = req.body;

    try {
        // Find the patient in the database
        const patient = await users.findById(patientId);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Find the appointment in the patient's appointments
        const appointmentIndex = patient.userappointments.findIndex(appointment => appointment._id == appointmentId);

        if (appointmentIndex === -1) {
            return res.status(404).json({ error: 'Appointment not found for the given patient' });
        }

        // Get the existing appointment
        const existingAppointment = patient.userappointments[appointmentIndex];

        // Check if the patient is trying to change the doctor
        if (newDoctorId) {
            // Find the new doctor in the database
            const newDoctor = await doctors.findById(newDoctorId);

            if (!newDoctor) {
                return res.status(404).json({ error: 'New doctor not found' });
            }

            // Update the appointment with the new doctor
            existingAppointment.docID = newDoctorId;
        }

        // Check if the patient is trying to change the slot
        if (newTime && newDate) {
            // Update the appointment with the new slot
            existingAppointment.times = newTime;
            existingAppointment.dates = newDate;
        }

        // Save the updated patient information
        await patient.save();
        const channel = await setupRabbitMQ();
        const message = { doctorId: newDoctorId, patientId, operation: 'ReservationUpdated', appointment: updatedAppointment };
        channel.publish('clinic_reservation', '', Buffer.from(JSON.stringify(message)));

        res.json({ message: 'Appointment updated successfully', appointment: existingAppointment });
    } catch (error) {
        console.error("Error while updating appointment: ", error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

app.delete('/patients/:patientId/delete_appointments/:appointmentId', async (req, res) => {
    const patientId = req.params.patientId;
    const appointmentId = req.params.appointmentId;

    try {
        // Find the patient in the database
        const patient = await users.findById(patientId);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Find the appointment in the patient's appointments
        const appointmentIndex = patient.userappointments.findIndex(appointment => appointment._id == appointmentId);

        if (appointmentIndex === -1) {
            return res.status(404).json({ error: 'Appointment not found for the given patient' });
        }

        // Remove the appointment from the patient's appointments
        patient.userappointments.splice(appointmentIndex, 1);
        await patient.save();


        const channel = await setupRabbitMQ();
        const message = { doctorId: canceledAppointment.docID, patientId, operation: 'ReservationCancelled', appointment: canceledAppointment };
        channel.publish('clinic_reservation', '', Buffer.from(JSON.stringify(message)));


        res.json({ message: 'Appointment canceled successfully' });
    } catch (error) {
        console.error("Error while canceling appointment: ", error);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

app.get('/patients/:patientId/view_appointments', async (req, res) => {
    const patientId = req.params.patientId;

    try {
        // Find the patient in the database
        const patient = await users.findById(patientId);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Return the list of appointments for the patient
        res.json({ userappointments: patient.userappointments });
    } catch (error) {
        console.error("Error while fetching patient reservations: ", error);
        res.status(500).json({ error: 'Failed to fetch patient reservations' });
    }
});
// Endpoint to get a list of doctors
app.get('/doctors', async (req, res) => {
    try {
        const doctor = await doctors.find();
        res.json(doctor);
    } catch (error) {
        console.error("Error while fetching doctors: ", error);
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
});

// Endpoint to get available slots for a specific doctor
app.get('/doctors/:doctorId/slots', async (req, res) => {
    const doctorId = req.params.doctorId;

    try {
        const doc = await doctors.findById(doctorId);
        if (!doc) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Assuming the doc model has a field named 'availableSlots'
        res.json(doc.availableSlots);
    } catch (error) {
        console.error("Error while fetching slots: ", error);
        res.status(500).json({ error: 'Failed to fetch slots' });
    }
});

app.get('/doctors/:doctorId/messages', async (req, res) => {
    const doctorId = req.params.doctorId;
    const channel = await setupRabbitMQ();

    // Create a temporary queue for this doctor
    const { queue } = await channel.assertQueue('', { exclusive: true });
    channel.bindQueue(queue, 'clinic_reservation', '');

    channel.consume(queue, (msg) => {
        const message = JSON.parse(msg.content.toString());
        if (message.doctorId === doctorId) {
            res.json({ message: 'Doctor message received', data: message });
        }
    }, { noAck: true });
});


/*app.post("/doc_signin", async (req, res) =>{

    const newdoc = new doctors();
    const email = req.body.docemail;
    const docpass = req.body.docpass;
    newdoc.email = email;
    newdoc.docpass = docpass;
    doctors.findOne({email,docpass}).then((user) => {
        if (!user) {
            res.send('Invalid username or password');
        } else {
            res.send('login done');
        }
    })
        .catch((err) => {
            res.send('error');
        });
});*/