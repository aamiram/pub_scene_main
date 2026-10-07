const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pubscene.db');
const db = new Database(dbPath);

console.log('Connected to SQLite database: pubscene.db');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    whatsapp_consent INTEGER DEFAULT 1,
    city TEXT DEFAULT 'Nagpur',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    couple_passes INTEGER DEFAULT 0,
    stag_passes INTEGER DEFAULT 0,
    total_amount REAL NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    payment_status TEXT DEFAULT 'PENDING',
    pass_code TEXT UNIQUE NOT NULL,
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

// Helper: Save or Get User
function saveOrGetUser(userData) {
  return new Promise((resolve, reject) => {
    try {
      const { fullName, phone, email, whatsappConsent } = userData;
      const upsert = db.prepare(`
        INSERT INTO users (full_name, phone, email, whatsapp_consent)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          full_name = excluded.full_name,
          email = COALESCE(excluded.email, users.email),
          whatsapp_consent = excluded.whatsapp_consent
      `);
      upsert.run(fullName, phone, email, whatsappConsent ? 1 : 0);

      const user = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
      resolve(user.id);
    } catch (err) {
      reject(err);
    }
  });
}

// Helper: Create Booking Record
function createBooking(bookingData) {
  return new Promise((resolve, reject) => {
    try {
      const {
        userId,
        venueId,
        venueName,
        couplePasses,
        stagPasses,
        totalAmount,
        razorpayOrderId,
        passCode,
        status
      } = bookingData;

      const stmt = db.prepare(`
        INSERT INTO bookings (
          user_id, venue_id, venue_name, couple_passes, stag_passes,
          total_amount, razorpay_order_id, pass_code, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        userId,
        venueId,
        venueName,
        couplePasses,
        stagPasses,
        totalAmount,
        razorpayOrderId,
        passCode,
        status
      );

      resolve({ bookingId: info.lastInsertRowid, passCode });
    } catch (err) {
      reject(err);
    }
  });
}

// Helper: Update Booking Status
function updateBookingPayment(orderId, paymentId, status) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(`
        UPDATE bookings 
        SET payment_status = ?, razorpay_payment_id = ? 
        WHERE razorpay_order_id = ?
      `);
      const info = stmt.run(status, paymentId, orderId);
      resolve(info.changes);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  db,
  saveOrGetUser,
  createBooking,
  updateBookingPayment
};