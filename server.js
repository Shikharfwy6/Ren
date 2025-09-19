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
  return data.map(row => row.token);
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

      // 🔹 अगर token invalid है तो DB से delete कर दो
      if (err.errorInfo?.code === 'messaging/invalid-argument' || 
          err.errorInfo?.code === 'messaging/registration-token-not-registered') {
        await supabase.from('fcm_tokens').delete().eq('token', token);
        console.log(`🗑️ Invalid token removed: ${token}`);
      }
    }
  }
}


// 🔹 Duplicate prevention
let lastOrderId = null;

async function handleNewOrder(order) {
  if (order.id === lastOrderId) {
    console.log(`⚠️ Duplicate order ignored: ${order.id}`);
    return;
  }
  lastOrderId = order.id;

  await sendFCMNotification(
    'New Order',
    `Order #${order.id} by ${order.customer_name}`
  );
}


// 🔹 Orders listener (Supabase Realtime)
const ordersChannel = supabase
  .channel('orders-channel')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('🆕 New order event:', payload.new);
      handleNewOrder(payload.new);
    }
  )
  .subscribe((status) => {
    console.log("Realtime subscription status:", status);
  });

console.log("🚀 Server running. Listening for new orders...");
