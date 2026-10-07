// Nagpur localities used by the city filter.
const localities = [
  { id: 'all', name: 'All Areas' },
  { id: 'dharampeth', name: 'Dharampeth' },
  { id: 'civil_lines', name: 'Civil Lines' },
  { id: 'wardha_rd', name: 'Wardha Road' },
  { id: 'sadar', name: 'Sadar' }
];

// Fallback catalog if the API is unreachable. The server seeds the same records.
const eventsData = [
  {
    id: 'v-1',
    name: 'Bollywood Blast ft. DJ Tarab',
    venueName: 'Drinx Exchange Nagpur',
    areaId: 'dharampeth',
    areaName: 'Dharampeth',
    category: 'club_nights',
    date: 'Sat, 10 Oct • 7:00 PM',
    price: 99,
    coverPrice: 1000,
    offerText: 'Couple Entry Free before 9:30 PM',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    badge: 'EXCLUSIVE PASS'
  },
  {
    id: 'v-2',
    name: 'Vortex Melodic Techno Night',
    venueName: 'Vortex Cyber Lounge',
    areaId: 'civil_lines',
    areaName: 'Civil Lines',
    category: 'concerts',
    date: 'Sun, 11 Oct • 8:00 PM',
    price: 499,
    coverPrice: 1500,
    offerText: 'First 50 Entries Get Free VIP Shots',
    image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600&auto=format&fit=crop&q=80',
    badge: 'TECHNO SPECIAL'
  },
  {
    id: 'v-3',
    name: 'Sunday Sunset Acoustic Jamming',
    venueName: 'Sky Garden Terrace Lounge',
    areaId: 'sadar',
    areaName: 'Sadar',
    category: 'jamming',
    date: 'Sun, 11 Oct • 5:30 PM',
    price: 199,
    coverPrice: 500,
    offerText: 'Complimentary Mocktail with Pass',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    badge: 'SUNDOWNER'
  },
  {
    id: 'v-4',
    name: 'Standup Comedy & Cocktails',
    venueName: 'The Illusion Club & Bar',
    areaId: 'wardha_rd',
    areaName: 'Wardha Road',
    category: 'comedy',
    date: 'Fri, 16 Oct • 8:30 PM',
    price: 299,
    coverPrice: 800,
    offerText: 'Free Entry for Couples with Pre-Booking',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&auto=format&fit=crop&q=80',
    badge: 'LIMITED SEATS'
  }
];

const eventCatalog = eventsData.slice();

function findEventById(id) {
  return eventCatalog.find((event) => event.id === id);
}

function rememberEvents(list) {
  list.forEach((event) => {
    const index = eventCatalog.findIndex((item) => item.id === event.id);
    if (index >= 0) eventCatalog[index] = event;
    else eventCatalog.push(event);
  });
}

const venuesDirectory = [
  {
    id: 'org-1',
    name: 'The Vibe Club',
    verified: true,
    location: 'Dharampeth, Nagpur',
    rating: '★ 5.0',
    desc: 'Curating exclusive underground techno sessions & rooftop electronic jams.',
    tag: 'VIBE'
  },
  {
    id: 'org-2',
    name: 'Common Ground Club',
    verified: true,
    location: 'Civil Lines, Nagpur',
    rating: '★ 4.9',
    desc: 'A space for music, community jams, dance, and weekend nightlife vibes.',
    tag: 'CGC'
  },
  {
    id: 'org-3',
    name: 'Nine O Nine Lounge',
    verified: true,
    location: 'Wardha Road, Nagpur',
    rating: '★ 4.8',
    desc: 'Premier multi-genre dance floor, craft beer & high-energy weekend DJ nights.',
    tag: '909'
  }
];
