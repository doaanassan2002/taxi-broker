import { Router, Request, Response } from 'express';
import { setupExchange, publishLocation } from '../services/FanoutBroker';
import { subscribePassenger } from '../services/Passenger';
import amqp from 'amqplib';

const router = Router();
let channel: amqp.Channel;

// تهيئة الـ Exchange عند البداية
setupExchange().then((result) => {
  channel = result.channel;
  console.log('🚀 RabbitMQ is ready!');
});

// السائق يبعث موقعه
router.post('/driver/location', async (req: Request, res: Response) => {
  const { driverId, lat, lng } = req.body;
  await publishLocation(channel, driverId, lat, lng);
  res.json({ status: 'success', message: `🚕 موقع السائق ${driverId} أُرسل` });
});

// راكب يشترك لاستقبال المواقع
router.post('/passenger/subscribe', async (req: Request, res: Response) => {
  const { passengerId } = req.body;
  await subscribePassenger(passengerId);
  res.json({ status: 'success', message: `🧍 راكب ${passengerId} مشترك` });
});

// مراقبة الـ DLQ
router.get('/dlq/monitor', async (req: Request, res: Response) => {
  const connection = await amqp.connect('amqp://localhost');
  const ch = await connection.createChannel();
  const queue = await ch.checkQueue('dlq_queue');
  await connection.close();

  res.json({
    status: 'checked',
    dlq: {
      name: 'dlq_queue',
      messages: queue.messageCount,
      consumers: queue.consumerCount,
      info: queue.messageCount > 0 
        ? `⚠️ في ${queue.messageCount} رسالة فاشلة تحتاج مراجعة!`
        : '✅ الـ DLQ فارغ — كل شي تمام'
    }
  });
});

export default router;