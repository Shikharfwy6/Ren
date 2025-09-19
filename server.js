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


// 🔹 Function to fetch tokens from Supabase
async function getAllTokens() {
  const { data, error } = await supabase.from('fcm_tokens').select('token');
  if (error) {
    console.error("❌ Error fetching tokens:", error);
    return [];
  }
  return data.map(row => row.token); // सिर्फ token की array बना दी
}


// 🔹 Notification function (loop with single send)
async function sendFCMNotification(title, body) {
  const tokens = await getAllTokens();

  if (!tokens.length) {
    console.log("⚠️ No tokens found in Supabase.");
    return;
  }

  for (const token of tokens) {
    const message = {
      notification: { title, body },
      token: token,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`✅ Notification sent to ${token}:`, response);
    } catch (err) {
      console.error(`❌ Error sending to ${token}:`, err);
    }
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

      // हर नया order आने पर सभी tokens को notification भेजो
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
