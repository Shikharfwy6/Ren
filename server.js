import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Firebase Admin init (env से service account parse करना)
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

// 🔹 Supabase से सारे tokens fetch करने का function
async function getAllTokens() {
  const { data, error } = await supabase.from("fcm_tokens").select("token");
  if (error) {
    console.error("❌ Error fetching tokens:", error);
    return [];
  }
  return data.map((row) => row.token);
}

// 🔹 Multiple tokens पर notification भेजने का function
async function sendNotificationToAll(title, body) {
  const tokens = await getAllTokens();

  if (!tokens.length) {
    console.log("⚠️ No device tokens found in Supabase");
    return;
  }

  const message = {
    notification: { title, body },
    tokens, // 👈 सारे tokens array
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(
      `✅ Notifications sent: ${response.successCount} success, ${response.failureCount} failed`
    );

    if (response.failureCount > 0) {
      const failed = response.responses
        .map((r, i) => (!r.success ? tokens[i] : null))
        .filter((t) => t !== null);
      console.warn("⚠️ Failed tokens:", failed);
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
      sendNotificationToAll(
        'New Order',
        `Order #${order.id} by ${order.customer_name}`
      );
    }
  )
  .subscribe((status) => {
    console.log("Realtime subscription status:", status);
  });

console.log("🚀 Server running. Listening for new orders...");
