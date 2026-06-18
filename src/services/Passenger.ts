import amqp from 'amqplib';

export async function subscribePassenger(passengerId: string) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // ربط الطابور بالـ DLX بحيث إذا فشلت الرسالة تذهب للـ DLQ
  await channel.assertQueue(`passenger_${passengerId}`, {
    exclusive: false,
    deadLetterExchange: 'dlx_exchange',
    deadLetterRoutingKey: 'failed'
  });

  await channel.bindQueue(`passenger_${passengerId}`, 'taxi_locations', '');

 
  channel.consume(`passenger_${passengerId}`, (msg) => {
  if (msg) {
    const data = JSON.parse(msg.content.toString());
    
    // افتعال عطل إذا كان الـ driverId هو "CRASH"
    if (data.driverId === "CRASH") {
      console.log("🔥 عطل متعمد في معالجة السائق CRASH");
      channel.nack(msg, false, false); // هذا سيؤدي لنقل الرسالة إلى الـ DLQ
    } else {
      console.log(`📍 success processing : ${data.driverId}`);
      channel.ack(msg);
    }
  }
});
}