import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Firebase Admin init (env से service account parse करना)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
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

    const response = await admin.messaging().sendMulticast(message);
    console.log('Notifications sent:', response.successCount);
}

// Listen to orders table
supabase
  .channel('public:orders')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      console.log('New order:', payload.new);
      const order = payload.new;
      sendFCMNotification('New Order', `Order #${order.id} by ${order.customer_name}`);
  })
  .subscribe();

console.log("🚀 Server running. Listening for new orders...");
