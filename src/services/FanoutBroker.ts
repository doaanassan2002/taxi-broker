import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';
const EXCHANGE_NAME = 'taxi_locations';
const DLX_NAME = 'dlx_exchange'; // الـ Exchange الميت
const DLQ_NAME = 'dlq_queue';    // الطابور الميت

export async function setupExchange() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  // 1. إنشاء الـ Fanout Exchange العادي
  await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: false });

  // 2. إعداد الـ Dead Letter Infrastructure
  await channel.assertExchange(DLX_NAME, 'direct', { durable: false });
  await channel.assertQueue(DLQ_NAME, { durable: false });
  await channel.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

  console.log('✅ Broker and DLQ are ready!');
  return { connection, channel };
}

export async function publishLocation(channel: amqp.Channel, driverId: string, lat: number, lng: number) {
  const message = JSON.stringify({ driverId, lat, lng, timestamp: new Date().toISOString() });
  channel.publish(EXCHANGE_NAME, '', Buffer.from(message));
}