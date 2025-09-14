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


/* 🔹 Single Token (active)
const TOKEN = "dAPYZSMzT2XyyIzWnbE-8g:APA91bG_4EKwUrp3eagQoV0frEqzl2R58zLfDYSnpnDXxvikOJas3egDWJAQpZxvunPbYjq1P14CUP-jiexE5NjqoOfZGAY37MCSCGvqZ7vpbYCAswT2LFQ";

// Single token notification function
async function sendFCMNotification(title, body) {
  const message = {
    notification: { title, body },
    token: TOKEN, // 👈 Single token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
  } catch (err) {
    console.error("❌ Error sending notification:", err);
  }
}  */



// 🔹 Multi Token (commented out for now)
// बस ऊपर वाला Single Token function हटाकर इसको use करना है

const TOKENS = [
  "dAPYZSMzT2XyyIzWnbE-8g:APA91bG_4EKwUrp3eagQoV0frEqzl2R58zLfDYSnpnDXxvikOJas3egDWJAQpZxvunPbYjq1P14CUP-jiexE5NjqoOfZGAY37MCSCGvqZ7vpbYCAswT2LFQ",
  "fiBPpT8lmcVguwtP6smxUo:APA91bGosCdEoQmji1Fhcr5xVlMA_uGBlRyPFNn0sxNo5wCAFE5ZtFfsD3N1_T93NLkrQv1ikNU8Aic4al3km20ABFY7Wm0IEHio80KyxBiRqNj_vug7-2A"
];

async function sendFCMNotification(title, body) {
  const message = {
    notification: { title, body },
    tokens: TOKENS, // 👈 Array of tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`✅ Notifications sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ Failed for token ${TOKENS[idx]}:`, resp.error);
        }
      });
    }
  } catch (err) {
    console.error("❌ Error sending notifications:", err);
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

      // हर नया order आने पर notification भेजो
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
