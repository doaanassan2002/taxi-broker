# 🚕 Taxi Fan-out — نظام نشر مواقع السائقين الفوري

نظام موزع يطبق مفهوم **Fan-out Message Broadcasting** مع **Dead Letter Queue** باستخدام Node.js + TypeScript + RabbitMQ.

---

## 📌 ما هو المشروع؟

يحاكي هذا المشروع نظام تتبع السائقين في تطبيقات مثل **Uber** و**Careem** — حيث يبعث السائق موقعه مرة واحدة، ويستقبله جميع الركاب المشتركين في نفس اللحظة، مع حماية كاملة للرسائل الفاشلة عبر نظام DLQ.

---

## 🧠 المفاهيم المطبقة

### 📡 Fan-out Pattern
السائق يبعث رسالة **واحدة** فقط، والـ Broker يوزعها على **كل** المشتركين دفعة واحدة.

```
السائق يبعث GPS
      │
      ▼
[taxi_locations Exchange - fanout]
      │
      ├──→ [passenger-1 Queue] → ACK ✅
      ├──→ [passenger-2 Queue] → ACK ✅
      └──→ [passenger-N Queue] → ACK ✅
```

### ✅ ACK — تأكيد الاستلام
عند معالجة الرسالة بنجاح، يبعث المستقبل إشارة ACK للـ Broker ليحذفها من الذاكرة.
```typescript
channel.ack(msg); // ✅ وصلت وتمت معالجتها، امسحها
```

### ☠️ NACK + DLQ — الرسائل الفاشلة
عند فشل المعالجة، تنتقل الرسالة تلقائياً لقائمة الرسائل الميتة بدل أن تضيع.
```typescript
channel.nack(msg, false, false); // ❌ فشلت، أرسلها للـ DLQ
```

```
فشل المعالجة
      │
      ▼
[dlx_exchange - direct]
      │
      ▼
[dlq_queue] 💀 ← للمراجعة اليدوية
```

---

## 🐰 واجهة RabbitMQ Management

### الوصول للواجهة
```
http://localhost:15672
Username: guest
Password: guest
```

### شرح الأقسام

#### 📊 Overview — النظرة العامة
| المؤشر | المعنى |
|--------|--------|
| Ready | رسائل جاهزة لم تُعالج بعد |
| Unacked | رسائل قيد المعالجة |
| Total | المجموع الكلي |

#### 🔌 Connections — الاتصالات
كل `amqp.connect()` بالكود يفتح connection منفصل:
```
Connection 1 ← setupExchange() الاتصال الرئيسي
Connection 2 ← passenger-1 يستقبل
Connection 3 ← passenger-2 يستقبل
```

#### 📬 Exchanges — صناديق البريد
| الاسم | النوع | الوظيفة |
|-------|-------|---------|
| `taxi_locations` | fanout | يوزع مواقع السائقين على الكل |
| `dlx_exchange` | direct | يستقبل الرسائل الفاشلة ويوجهها للـ DLQ |

#### 📥 Queues — الطوابير
| الاسم | الوظيفة |
|-------|---------|
| `passenger_X` | طابور خاص لكل راكب |
| `dlq_queue` | قبر الرسائل الفاشلة للمراجعة |

**رموز الطوابير:**
```
D   = Durable (محفوظة عند إعادة التشغيل)
DLX = Dead Letter Exchange مربوطة
DLK = Dead Letter Routing Key = 'failed'
```

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| Node.js | بيئة التشغيل |
| TypeScript | لغة البرمجة |
| Express | API Server |
| amqplib | التواصل مع RabbitMQ |
| RabbitMQ (Docker) | الـ Message Broker |

---

## 📁 هيكل المشروع

```
taxi-fanout/
├── src/
│   ├── index.ts                    # نقطة الدخول
│   ├── services/
│   │   ├── FanoutBroker.ts         # إنشاء Exchange وDLQ وإرسال المواقع
│   │   └── Passenger.ts            # اشتراك الركاب واستقبال المواقع
│   └── routes/
│       └── api.ts                  # الـ API endpoints
├── package.json
└── tsconfig.json
```

---

## ⚙️ طريقة التشغيل

### 1. المتطلبات
- Node.js
- Docker

### 2. تشغيل RabbitMQ
```bash
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:management-alpine
```

### 3. تثبيت المكتبات
```bash
npm install
```

### 4. تشغيل السيرفر
```bash
npm run dev
```

السيرفر: `http://localhost:3001`
لوحة RabbitMQ: `http://localhost:15672`

---

## 🔗 الـ API Endpoints

### 1. اشتراك راكب
```
POST /api/passenger/subscribe
```
```json
{ "passengerId": "passenger-1" }
```
**الاستجابة:**
```json
{ "status": "success", "message": "🧍 راكب passenger-1 مشترك" }
```

---

### 2. السائق يبعث موقعه
```
POST /api/driver/location
```
```json
{ "driverId": "driver-1", "lat": 31.9, "lng": 35.2 }
```
**الاستجابة:**
```json
{ "status": "success", "message": "🚕 موقع السائق driver-1 أُرسل" }
```

---

### 3. افتعال عطل → DLQ
```
POST /api/driver/location
```
```json
{ "driverId": "CRASH", "lat": 0, "lng": 0 }
```
**النتيجة:** الرسالة تنتقل تلقائياً للـ DLQ 💀

---

### 4. مراقبة الـ DLQ
```
GET /api/dlq/monitor
```
**الاستجابة:**
```json
{
  "status": "checked",
  "dlq": {
    "name": "dlq_queue",
    "messages": 2,
    "info": "⚠️ في 2 رسالة فاشلة تحتاج مراجعة!"
  }
}
```

---

## 🧪 سيناريو اختبار كامل

```
# 1. اشترك ركابين
POST /api/passenger/subscribe → { "passengerId": "passenger-1" }
POST /api/passenger/subscribe → { "passengerId": "passenger-2" }

# 2. سائق يبعث موقعه
POST /api/driver/location → { "driverId": "driver-1", "lat": 31.9, "lng": 35.2 }

# التيرمينال:
📍 تم المعالجة بنجاح: driver-1  ← passenger-1
📍 تم المعالجة بنجاح: driver-1  ← passenger-2

# 3. افتعل عطل
POST /api/driver/location → { "driverId": "CRASH", "lat": 0, "lng": 0 }

# التيرمينال:
🔥 عطل متعمد في معالجة السائق CRASH  ← passenger-1
🔥 عطل متعمد في معالجة السائق CRASH  ← passenger-2

# 4. تحقق من DLQ
GET /api/dlq/monitor
→ messages: 2 ⚠️

# 5. تحقق بصرياً
http://localhost:15672 → Queues
→ dlq_queue: Ready: 2 💀
→ passenger_passenger-1: Ready: 0 ✅
→ passenger_passenger-2: Ready: 0 ✅
```

---

## 💡 مثال واقعي

هذا النظام يشبه ما تستخدمه شركات مثل Uber وCareem:

- السائق يبعث موقعه كل ثانية **مرة واحدة فقط**
- RabbitMQ يوزعه فوراً على **كل الركاب القريبين**
- إذا فشل التسليم لراكب → الرسالة تحفظ بالـ **DLQ** للمراجعة
- بدون Fan-out: كل راكب كان سيسأل السيرفر كل ثانية = ضغط هائل

---

## 👨‍💻 المطور

مشروع أكاديمي لمادة **الأنظمة الموزعة**
