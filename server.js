const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Firebase Admin init (env से service account parse करना)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// सभी admin tokens fetch
async function getAdminTokens() {
  const { data, error } = await supabase.from('fcm_tokens').select('token');
  if (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
  return data.map(t => t.token);
}

// Send FCM notification
async function sendFCMNotification(title, body) {
  const tokens = await getAdminTokens();
  if (tokens.length === 0) return console.log('No tokens found');

  const message = {
    notification: { title, body },
    tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Notifications sent:', response.successCount);
  } catch (err) {
    console.error('Error sending notifications:', err);
  }
}

// Listen to orders table (Realtime)
supabase
  .channel('orders-channel')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('New order:', payload.new);
      const order = payload.new;
      sendFCMNotification('New Order', `Order #${order.id} by ${order.customer_name}`);
    }
  )
  .subscribe();

console.log("🚀 Server running. Listening for new orders...");
