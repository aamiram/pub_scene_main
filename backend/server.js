const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
require('dotenv').config();

const {
  saveOrGetUser,
  createBooking,
  updateBookingPayment,
  listEvents,
  getEventById,
  listOrganizers,
  setFollow,
  createCollabLead,
  listAdminUsers
} = require('./database');

const app = express();
app.use(cors());
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl.startsWith('/api/razorpay-webhook')) {
      req.rawBody = buf;
    }
  }
}));

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

app.get('/api/events', (req, res) => {
  try {
    const events = listEvents({
      category: req.query.category,
      area: req.query.area,
      q: typeof req.query.q === 'string' ? req.query.q.trim() : ''
    });
    res.json({ total: events.length, events });
  } catch (err) {
    console.error('Error listing events:', err);
    res.status(500).json({ error: 'Could not load events' });
  }
});

app.get('/api/organizers', (req, res) => {
  try {
    const organizers = listOrganizers(req.query.clientId);
    res.json({ organizers });
  } catch (err) {
    console.error('Error listing organizers:', err);
    res.status(500).json({ error: 'Could not load organizers' });
  }
});

app.post('/api/follows', (req, res) => {
  try {
    const { organizerId, clientId, following } = req.body || {};
    if (!organizerId || !clientId) {
      return res.status(400).json({ error: 'Organizer and client id are required' });
    }
    const result = setFollow(organizerId, String(clientId), !!following);
    if (!result) return res.status(404).json({ error: 'Organizer not found' });
    res.json(result);
  } catch (err) {
    console.error('Error updating follow:', err);
    res.status(500).json({ error: 'Could not update follow' });
  }
});

app.post('/api/collab', (req, res) => {
  try {
    const { fullName, phone, email, message } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!fullName || !String(fullName).trim() || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Name and a valid phone number are required' });
    }
    const lead = createCollabLead({
      fullName: String(fullName).trim(),
      phone: cleanPhone,
      email: email ? String(email).trim() : '',
      message: message ? String(message).trim() : ''
    });
    res.status(201).json({ ...lead, message: 'Collaboration request received' });
  } catch (err) {
    console.error('Error saving collab lead:', err);
    res.status(500).json({ error: 'Could not save collaboration request' });
  }
});

app.post('/api/create-pass-order', async (req, res) => {
  try {
    const { user, booking } = req.body || {};

    if (!user || !user.fullName || !user.phone) {
      return res.status(400).json({ error: 'User full name and mobile number are mandatory' });
    }
    if (!booking || !booking.venueId) {
      return res.status(400).json({ error: 'Choose an event before booking a pass' });
    }

    const event = getEventById(booking.venueId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const couplePasses = Math.max(0, parseInt(booking.couplePasses, 10) || 0);
    const stagPasses = Math.max(0, parseInt(booking.stagPasses, 10) || 0);
    if (couplePasses + stagPasses < 1) {
      return res.status(400).json({ error: 'Choose at least one pass' });
    }

    const amount = stagPasses * Number(event.coverPrice);
    const userId = await saveOrGetUser(user);
    const passCode = 'PUB-' + Math.floor(100000 + Math.random() * 900000);

    if (amount === 0) {
      const savedPass = await createBooking({
        userId,
        venueId: event.id,
        venueName: event.name,
        couplePasses,
        stagPasses,
        totalAmount: 0,
        razorpayOrderId: 'FREE_ENTRY_' + Date.now(),
        passCode,
        status: 'FREE_CONFIRMED'
      });

      return res.status(200).json({
        isFree: true,
        passCode: savedPass.passCode,
        venueName: event.name,
        message: 'Free entry pass generated successfully'
      });
    }

    if (!razorpay) {
      return res.status(503).json({ error: 'Paid checkout is not configured' });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${passCode}`,
      notes: {
        userId: userId.toString(),
        venue: event.name,
        phone: user.phone
      }
    };

    const order = await razorpay.orders.create(options);

    await createBooking({
      userId,
      venueId: event.id,
      venueName: event.name,
      couplePasses,
      stagPasses,
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
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating pass order:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, passCode } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ status: 'failure', message: 'Payment details are incomplete' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ status: 'failure', message: 'Payment verification is not configured' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'SUCCESS');
      return res.status(200).json({ status: 'success', message: 'Payment verified', passCode });
    }

    await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'FAILED_SIGNATURE');
    return res.status(400).json({ status: 'failure', message: 'Signature verification failed' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/razorpay-webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-razorpay-signature'];
    if (!webhookSecret || !webhookSignature || !req.rawBody) {
      return res.status(400).json({ status: 'invalid_signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== webhookSignature) {
      console.warn('Webhook signature mismatch. Dropping request.');
      return res.status(400).json({ status: 'invalid_signature' });
    }

    const event = req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      if (paymentEntity?.order_id && paymentEntity?.id) {
        await updateBookingPayment(paymentEntity.order_id, paymentEntity.id, 'SUCCESS_WEBHOOK');
        console.log(`[Webhook Confirmed] Order ${paymentEntity.order_id} marked as SUCCESS.`);
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', (_req, res) => {
  try {
    const users = listAdminUsers();
    res.status(200).json({ total: users.length, users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PUB SCENE API server running on port ${PORT}`);
});
