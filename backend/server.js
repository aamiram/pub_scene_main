const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();

const { saveOrGetUser, createBooking, updateBookingPayment, db } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,         // Loaded from .env
  key_secret: process.env.RAZORPAY_KEY_SECRET  // Loaded from .env
});

// -------------------------------------------------------------
// 1. CREATE BOOKING & RAZORPAY ORDER ENDPOINT
// -------------------------------------------------------------
app.post('/api/create-pass-order', async (req, res) => {
  try {
    const { user, booking } = req.body;

    // Validate Input
    if (!user || !user.fullName || !user.phone) {
      return res.status(400).json({ error: 'User full name and mobile number are mandatory' });
    }

    // A. Save or Update User Contact Info in SQLite DB
    const userId = await saveOrGetUser(user);

    // Generate unique Pass ID
    const passCode = 'PUB-' + Math.floor(100000 + Math.random() * 900000);
    const amount = Number(booking.totalAmount);

    // B. Handle 100% Free Guestlist Entries (₹0)
    if (amount === 0) {
      const savedPass = await createBooking({
        userId,
        venueId: booking.venueId,
        venueName: booking.venueName,
        couplePasses: booking.couplePasses || 0,
        stagPasses: booking.stagPasses || 0,
        totalAmount: 0,
        razorpayOrderId: 'FREE_ENTRY_' + Date.now(),
        passCode,
        status: 'FREE_CONFIRMED'
      });

      return res.status(200).json({
        isFree: true,
        passCode: savedPass.passCode,
        venueName: booking.venueName,
        message: 'Free entry pass generated successfully'
      });
    }

    // C. Create Paid Razorpay Order
    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: `rcpt_${passCode}`,
      notes: {
        userId: userId.toString(),
        venue: booking.venueName,
        phone: user.phone
      }
    };

    const order = await razorpay.orders.create(options);

    // Save initial pending booking record
    await createBooking({
      userId,
      venueId: booking.venueId,
      venueName: booking.venueName,
      couplePasses: booking.couplePasses || 0,
      stagPasses: booking.stagPasses || 0,
      totalAmount: amount,
      razorpayOrderId: order.id,
      passCode,
      status: 'PENDING'
    });

    res.status(200).json({
      isFree: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      passCode,
      keyId: process.env.RAZORPAY_KEY_ID // Send client public key
    });
  } catch (err) {
    console.error('Error creating pass order:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// -------------------------------------------------------------
// 2. VERIFY PAYMENT SIGNATURE ENDPOINT
// -------------------------------------------------------------
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, passCode } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Payment Authenticated -> Update booking status to SUCCESS
      await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'SUCCESS');
      return res.status(200).json({ status: 'success', message: 'Payment verified', passCode });
    } else {
      await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'FAILED_SIGNATURE');
      return res.status(400).json({ status: 'failure', message: 'Signature verification failed' });
    }
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. RAZORPAY ASYNCHRONOUS WEBHOOK ENDPOINT
// -------------------------------------------------------------
app.post('/api/razorpay-webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature === webhookSignature) {
      const event = req.body.event;

      if (event === 'payment.captured' || event === 'order.paid') {
        const paymentEntity = req.body.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;

        await updateBookingPayment(orderId, paymentId, 'SUCCESS_WEBHOOK');
        console.log(`[Webhook Confirmed] Order ${orderId} marked as SUCCESS.`);
      }

      return res.status(200).json({ status: 'ok' });
    } else {
      console.warn('Webhook signature mismatch. Dropping request.');
      return res.status(400).json({ status: 'invalid_signature' });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. ADMIN CRM LEAD RETRIEVAL (GET ALL USERS & LEADS)
// -------------------------------------------------------------
app.get('/api/admin/users', (req, res) => {
  const query = `
    SELECT u.id, u.full_name, u.phone, u.email, u.city, u.created_at,
           COUNT(b.id) as total_bookings,
           COALESCE(SUM(b.total_amount), 0) as lifetime_spent
    FROM users u
    LEFT JOIN bookings b ON u.id = b.user_id AND b.payment_status IN ('SUCCESS', 'FREE_CONFIRMED', 'SUCCESS_WEBHOOK')
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ total: rows.length, users: rows });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PUB SCENE API server running on port ${PORT}`);
});