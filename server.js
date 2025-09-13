import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Firebase Admin init
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Server is running ✅');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 👇 सिर्फ एक टेस्ट टोकन
const TEST_TOKEN =
  "dAPYZSMzT2XyyIzWnbE-8g:APA91bG_4EKwUrp3eagQoV0frEqzl2R58zLfDYSnpnDXxvikOJas3egDWJAQpZxvunPbYjq1P14CUP-jiexE5NjqoOfZGAY37MCSCGvqZ7vpbYCAswT2LFQ";

// 🔹 सिर्फ single token पर notification भेजने का function
async function sendFCMNotification(title, body) {
  const message = {
    notification: { title, body },
    token: TEST_TOKEN, // 👈 सिर्फ एक ही token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
  } catch (err) {
    console.error("❌ Error sending notification:", err);
  }
}

// 🔹 Orders listener (Supabase Realtime)
supabase
  .channel('orders-channel')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('🆕 New order:', payload.new);
      const order = payload.new;

      // हर नया order आने पर सिर्फ TEST_TOKEN वाले device को notification
      sendFCMNotification(
        'New Order',
        `Order #${order.id} by ${order.customer_name}`
      );
    }
  )
  .subscribe((status) => {
    console.log("Realtime subscription status:", status);
  });

console.log("🚀 Server running. Listening for new orders...");
