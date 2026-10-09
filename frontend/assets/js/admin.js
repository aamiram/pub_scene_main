const TOKEN_KEY = 'pubscene-admin-token';

const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const loginError = document.getElementById('loginError');
const formError = document.getElementById('formError');
const flyerPreview = document.getElementById('flyerPreview');

let flyerData = '';
let overview = { events: [], bookings: [], leads: [] };

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

async function api(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(path, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error(data.error || 'Please log in again');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

function money(value) {
  return '₹' + Number(value || 0);
}

function renderFlyers() {
  const host = document.getElementById('flyers');
  if (!overview.events.length) {
    host.innerHTML = '<div class="card"><p>No flyers yet. Use Add flyer.</p></div>';
    return;
  }
  host.innerHTML = '<div class="flyer-list">' + overview.events.map((event) => `
    <article class="card flyer">
      <img src="${event.image}" alt="" />
      <div>
        <strong>${escapeHtml(event.name)}</strong>
        <p class="muted">${escapeHtml(event.date)}<br>${escapeHtml(event.venueName)}</p>
        <p>Couple ${money(event.couplePrice)} · Stag ${money(event.coverPrice)}</p>
        <div class="actions">
          <button class="ghost" type="button" data-edit="${escapeHtml(event.id)}">Edit</button>
          <button class="danger" type="button" data-remove="${escapeHtml(event.id)}">Remove</button>
        </div>
      </div>
    </article>
  `).join('') + '</div>';
}

function guestContact(row) {
  const phone = row.phone && !String(row.phone).startsWith('ig:') ? row.phone : '';
  const instagram = row.instagram ? '@' + String(row.instagram).replace(/^@+/, '') : '';
  return [phone, instagram].filter(Boolean).join(' · ');
}

function renderBookings() {
  const host = document.getElementById('bookings');
  if (!overview.bookings.length) {
    host.innerHTML = '<div class="card"><p>No pass bookings yet. New bookings from the website show up here.</p></div>';
    return;
  }
  host.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
    overview.bookings.map((row) => `
      <div class="bg-[#100e21] border border-[#2b274c] rounded-xl p-4 flex flex-col gap-2">
        <div class="flex justify-between items-start">
          <strong class="text-white text-base">${escapeHtml(row.full_name || '')}${row.age ? ', ' + escapeHtml(row.age) : ''}</strong>
          <span class="text-[10px] font-bold px-2 py-1 rounded bg-[#17152b] ${row.payment_status === 'Paid' ? 'text-green-400' : 'text-[#ff007f]'} uppercase tracking-wide">${escapeHtml(row.payment_status || 'Pending')}</span>
        </div>
        <p class="text-xs text-gray-400"><i class="fa-solid fa-address-book mr-1.5 w-3"></i> ${escapeHtml(guestContact(row))}</p>
        <p class="text-sm font-medium mt-1"><i class="fa-solid fa-location-dot text-[#ff007f] mr-1.5 w-3"></i> ${escapeHtml(row.venue_name || '')}</p>
        <div class="bg-[#17152b] rounded-lg p-3 mt-2 flex justify-between items-center text-sm border border-[#2b274c]">
          <div class="text-gray-300">
            <span class="text-gray-500">Couple:</span> ${Number(row.couple_passes || 0)} <br>
            <span class="text-gray-500">Stag:</span> ${Number(row.stag_passes || 0)}
          </div>
          <div class="text-right">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Total</div>
            <strong class="text-[#00f0ff] text-lg leading-none">${money(row.total_amount)}</strong>
          </div>
        </div>
      </div>
    `).join('') + '</div>';
}

function renderMessages() {
  const host = document.getElementById('messages');
  if (!overview.leads.length) {
    host.innerHTML = '<div class="card"><p>No collaboration messages yet.</p></div>';
    return;
  }
  host.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + overview.leads.map((lead) => `
    <article class="bg-[#100e21] border border-[#2b274c] rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
      <div class="absolute top-0 left-0 w-1 h-full bg-[#bd00ff]"></div>
      <strong class="text-white text-base pl-2">${escapeHtml(lead.full_name)}</strong>
      <p class="text-xs text-gray-400 pl-2"><i class="fa-solid fa-phone mr-1"></i> ${escapeHtml(lead.phone || '')} &nbsp; <i class="fa-regular fa-envelope ml-2 mr-1"></i> ${escapeHtml(lead.email || '')}</p>
      <div class="bg-[#17152b] text-gray-300 text-sm p-3 rounded-lg border border-[#2b274c] mt-2 ml-2">
        <i class="fa-solid fa-quote-left text-gray-600 mr-2"></i> ${escapeHtml(lead.message || '')}
      </div>
    </article>
  `).join('') + '</div>';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearForm() {
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('formTitle').textContent = 'Add a flyer';
  flyerData = '';
  flyerPreview.hidden = true;
  flyerPreview.removeAttribute('src');
  document.getElementById('organizerPin').value = '';
  document.getElementById('eventCapacity').value = '100';
  document.getElementById('ticketsContainer').innerHTML = '';
  formError.textContent = '';
}

function addTicketRow(name = '', price = '') {
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center bg-[#1a1736] p-2 rounded';
  div.innerHTML = `
    <input type="text" placeholder="e.g. VIP Couple" value="${name}" class="ticket-name w-1/2 bg-[#18152e] text-white border border-[#3a3560] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#00f0ff]" />
    <input type="number" placeholder="Price (₹)" value="${price}" class="ticket-price w-1/3 bg-[#18152e] text-white border border-[#3a3560] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#00f0ff]" />
    <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-400 p-1"><i class="fa-solid fa-trash"></i></button>
  `;
  document.getElementById('ticketsContainer').appendChild(div);
}

function getCustomTickets() {
  const rows = document.querySelectorAll('#ticketsContainer > div');
  const tickets = [];
  rows.forEach(row => {
    const name = row.querySelector('.ticket-name').value.trim();
    const price = parseInt(row.querySelector('.ticket-price').value.trim(), 10) || 0;
    if (name) tickets.push({ name, price });
  });
  return tickets.length > 0 ? tickets : null;
}

function fillForm(event) {
  document.getElementById('eventId').value = event.id;
  document.getElementById('eventName').value = event.name || '';
  document.getElementById('eventStart').value = '';
  document.getElementById('eventEnd').value = '';
  document.getElementById('eventVenue').value = event.venueName || '';
  document.getElementById('eventCity').value = event.areaId || 'Nagpur';
  document.getElementById('eventCategory').value = event.category || 'club_nights';
  document.getElementById('couplePrice').value = Number(event.couplePrice || 0);
  document.getElementById('stagPrice').value = Number(event.coverPrice || 0);
  document.getElementById('offerText').value = event.offerText || '';
  document.getElementById('badge').value = event.badge || '';
  document.getElementById('organizerPin').value = event.organizerPin || '';
  document.getElementById('eventCapacity').value = event.capacity || 100;
  
  const container = document.getElementById('ticketsContainer');
  container.innerHTML = '';
  if (event.tickets && event.tickets.length > 0) {
    event.tickets.forEach(t => addTicketRow(t.name, t.price));
  }
  document.getElementById('formTitle').textContent = 'Edit flyer';
  flyerData = '';
  flyerPreview.src = event.image;
  flyerPreview.hidden = false;
  formError.textContent = '';
  document.querySelector('[data-tab="editor"]').click();
}

async function loadOverview() {
  overview = await api('/api/admin/overview');
  renderFlyers();
  renderBookings();
  renderMessages();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
      })
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    showApp();
    await loadOverview();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch (err) { /* already logged out */ }
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((item) => item.setAttribute('aria-selected', 'false'));
    button.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

document.getElementById('flyerFile').addEventListener('change', () => {
  const file = document.getElementById('flyerFile').files[0];
  flyerData = '';
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    formError.textContent = 'Flyer must be under 8 MB';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    flyerData = String(reader.result || '');
    flyerPreview.src = flyerData;
    flyerPreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

document.getElementById('cancelEdit').addEventListener('click', clearForm);

document.getElementById('eventForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  const id = document.getElementById('eventId').value;
    const startVal = document.getElementById('eventStart').value;
    const endVal = document.getElementById('eventEnd').value;
    let formattedDate = '';
    if (startVal) {
      const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' };
      formattedDate = new Date(startVal).toLocaleString('en-US', opts).replace(/,/g, '');
      if (endVal) {
        formattedDate += ' to ' + new Date(endVal).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/,/g, '');
      }
    }

  const payload = {
    name: document.getElementById('eventName').value.trim(),
    date: formattedDate,
    venueName: document.getElementById('eventVenue').value.trim(),
    areaId: document.getElementById('eventCity').value,
    category: document.getElementById('eventCategory').value,
    couplePrice: document.getElementById('couplePrice').value,
    stagPrice: document.getElementById('stagPrice').value,
    offerText: document.getElementById('offerText').value.trim(),
    badge: document.getElementById('badge').value.trim(),
    organizerPin: document.getElementById('organizerPin').value.trim(),
    capacity: document.getElementById('eventCapacity').value,
    tickets: getCustomTickets()
  };
  if (flyerData) payload.imageData = flyerData;
  try {
    if (id) await api('/api/admin/events/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
    clearForm();
    await loadOverview();
    document.querySelector('[data-tab="flyers"]').click();
  } catch (err) {
    formError.textContent = err.message;
  }
});

document.getElementById('flyers').addEventListener('click', async (event) => {
  const editId = event.target.closest('[data-edit]')?.dataset.edit;
  const removeId = event.target.closest('[data-remove]')?.dataset.remove;
  if (editId) {
    const found = overview.events.find((item) => item.id === editId);
    if (found) fillForm(found);
    return;
  }
  if (removeId) {
    if (!confirm('Remove this flyer from the website?')) return;
    try {
      await api('/api/admin/events/' + encodeURIComponent(removeId), { method: 'DELETE' });
      await loadOverview();
    } catch (err) {
      alert(err.message);
    }
  }
});

if (token()) {
  showApp();
  loadOverview().catch(() => showLogin());
}
