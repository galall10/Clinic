const amqp = require('amqplib');

async function setupRabbitMQ() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    await channel.assertExchange('clinic_reservation', 'fanout', { durable: false });

    return channel;
}

module.exports = setupRabbitMQ;
