const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pubscene.db');
const db = new Database(dbPath);

console.log('Connected to SQLite database: pubscene.db');

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

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    area_id TEXT NOT NULL,
    area_name TEXT NOT NULL,
    category TEXT NOT NULL,
    event_date TEXT NOT NULL,
    price REAL NOT NULL,
    cover_price REAL NOT NULL,
    offer_text TEXT,
    image TEXT,
    badge TEXT
  );

  CREATE TABLE IF NOT EXISTS organizers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    rating TEXT,
    description TEXT,
    tag TEXT
  );

  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organizer_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS collab_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const seedEvents = [
  ['v-1', 'Bollywood Blast ft. DJ Tarab', 'Drinx Exchange Nagpur', 'dharampeth', 'Dharampeth', 'club_nights', 'Sat, 10 Oct • 7:00 PM', 99, 1000, 'Couple Entry Free before 9:30 PM', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80', 'EXCLUSIVE PASS'],
  ['v-2', 'Vortex Melodic Techno Night', 'Vortex Cyber Lounge', 'civil_lines', 'Civil Lines', 'concerts', 'Sun, 11 Oct • 8:00 PM', 499, 1500, 'First 50 Entries Get Free VIP Shots', 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600&auto=format&fit=crop&q=80', 'TECHNO SPECIAL'],
  ['v-3', 'Sunday Sunset Acoustic Jamming', 'Sky Garden Terrace Lounge', 'sadar', 'Sadar', 'jamming', 'Sun, 11 Oct • 5:30 PM', 199, 500, 'Complimentary Mocktail with Pass', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80', 'SUNDOWNER'],
  ['v-4', 'Standup Comedy & Cocktails', 'The Illusion Club & Bar', 'wardha_rd', 'Wardha Road', 'comedy', 'Fri, 16 Oct • 8:30 PM', 299, 800, 'Free Entry for Couples with Pre-Booking', 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&auto=format&fit=crop&q=80', 'LIMITED SEATS']
];

const seedOrganizers = [
  ['org-1', 'The Vibe Club', 'Dharampeth, Nagpur', '★ 5.0', 'Curating exclusive underground techno sessions & rooftop electronic jams.', 'VIBE'],
  ['org-2', 'Common Ground Club', 'Civil Lines, Nagpur', '★ 4.9', 'A space for music, dance, community jams, and weekend nightlife vibes.', 'CGC'],
  ['org-3', 'Nine O Nine Lounge', 'Wardha Road, Nagpur', '★ 4.8', 'Nagpur’s high-energy lounge featuring Bollywood DJ nights & craft beer.', '909']
];

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (
    id, name, venue_name, area_id, area_name, category, event_date,
    price, cover_price, offer_text, image, badge
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertOrganizer = db.prepare(`
  INSERT OR IGNORE INTO organizers (id, name, location, rating, description, tag)
  VALUES (?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  seedEvents.forEach((row) => insertEvent.run(...row));
  seedOrganizers.forEach((row) => insertOrganizer.run(...row));
})();

function mapEvent(row) {
  return {
    id: row.id,
    name: row.name,
    venueName: row.venue_name,
    areaId: row.area_id,
    areaName: row.area_name,
    category: row.category,
    date: row.event_date,
    price: row.price,
    coverPrice: row.cover_price,
    offerText: row.offer_text,
    image: row.image,
    badge: row.badge
  };
}

function listEvents({ category, area, q } = {}) {
  let sql = 'SELECT * FROM events WHERE 1 = 1';
  const params = [];
  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (area && area !== 'all') {
    sql += ' AND area_id = ?';
    params.push(area);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR venue_name LIKE ? OR area_name LIKE ? OR offer_text LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY price ASC';
  return db.prepare(sql).all(...params).map(mapEvent);
}

function getEventById(id) {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  return row ? mapEvent(row) : null;
}

function listOrganizers(clientId) {
  return db.prepare(`
    SELECT o.id, o.name, o.location, o.rating, o.description, o.tag,
           (SELECT COUNT(*) FROM follows f WHERE f.organizer_id = o.id) AS followers,
           EXISTS(SELECT 1 FROM follows f WHERE f.organizer_id = o.id AND f.client_id = ?) AS following
    FROM organizers o
    ORDER BY o.name
  `).all(clientId || '');
}

function setFollow(organizerId, clientId, following) {
  const org = db.prepare('SELECT id FROM organizers WHERE id = ?').get(organizerId);
  if (!org) return null;
  if (following) {
    db.prepare('INSERT OR IGNORE INTO follows (organizer_id, client_id) VALUES (?, ?)').run(organizerId, clientId);
  } else {
    db.prepare('DELETE FROM follows WHERE organizer_id = ? AND client_id = ?').run(organizerId, clientId);
  }
  const followers = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE organizer_id = ?').get(organizerId).c;
  const isFollowing = !!db.prepare('SELECT 1 AS ok FROM follows WHERE organizer_id = ? AND client_id = ?').get(organizerId, clientId);
  return { organizerId, following: isFollowing, followers };
}

function createCollabLead({ fullName, phone, email, message }) {
  const info = db.prepare(`
    INSERT INTO collab_leads (full_name, phone, email, message)
    VALUES (?, ?, ?, ?)
  `).run(fullName, phone, email || null, message || null);
  return { id: info.lastInsertRowid };
}

function listAdminUsers() {
  return db.prepare(`
    SELECT u.id, u.full_name, u.phone, u.email, u.city, u.created_at,
           COUNT(b.id) as total_bookings,
           COALESCE(SUM(b.total_amount), 0) as lifetime_spent
    FROM users u
    LEFT JOIN bookings b ON u.id = b.user_id AND b.payment_status IN ('SUCCESS', 'FREE_CONFIRMED', 'SUCCESS_WEBHOOK')
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
}

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
      upsert.run(fullName, phone, email || null, whatsappConsent ? 1 : 0);
      const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      resolve(user.id);
    } catch (err) {
      reject(err);
    }
  });
}

function createBooking(bookingData) {
  return new Promise((resolve, reject) => {
    try {
      const {
        userId, venueId, venueName, couplePasses, stagPasses,
        totalAmount, razorpayOrderId, passCode, status
      } = bookingData;

      const info = db.prepare(`
        INSERT INTO bookings (
          user_id, venue_id, venue_name, couple_passes, stag_passes,
          total_amount, razorpay_order_id, pass_code, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, venueId, venueName, couplePasses, stagPasses,
        totalAmount, razorpayOrderId, passCode, status
      );

      resolve({ bookingId: info.lastInsertRowid, passCode });
    } catch (err) {
      reject(err);
    }
  });
}

function updateBookingPayment(orderId, paymentId, status) {
  return new Promise((resolve, reject) => {
    try {
      const info = db.prepare(`
        UPDATE bookings
        SET payment_status = ?, razorpay_payment_id = ?
        WHERE razorpay_order_id = ?
      `).run(status, paymentId, orderId);
      resolve(info.changes);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  db,
  listEvents,
  getEventById,
  listOrganizers,
  setFollow,
  createCollabLead,
  listAdminUsers,
  saveOrGetUser,
  createBooking,
  updateBookingPayment
};
