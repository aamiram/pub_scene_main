// Booking State Store
let activeBookingVenue = null;
let quantities = {
  couple: 1,
  stag: 0
};

function changeQty(type, delta) {
  quantities[type] = Math.max(0, quantities[type] + delta);
  document.getElementById(`qty-${type}`).innerText = quantities[type];
  updateSubtotal();
}

function updateSubtotal() {
  if (!activeBookingVenue) return;
  const coupleCost = quantities.couple * 0; // Couple Free Entry Rule
  const stagCost = quantities.stag * activeBookingVenue.coverPrice;
  const total = coupleCost + stagCost;
  document.getElementById('bookingTotalDisplay').innerText = `₹${total}`;
  return total;
}

function openBookingModal(venueId) {
  const venue = venuesData.find(v => v.id === venueId);
  if (!venue) return;

  activeBookingVenue = venue;
  quantities.couple = 1;
  quantities.stag = 0;

  document.getElementById('modalClubName').innerText = venue.name;
  document.getElementById('modalClubArea').innerText = venue.areaName;
  document.getElementById('modalClubOffer').innerText = venue.offerText;
  document.getElementById('qty-couple').innerText = '1';
  document.getElementById('qty-stag').innerText = '0';
  
  updateSubtotal();

  document.getElementById('modalBookingForm').classList.remove('hidden');
  document.getElementById('modalPassSuccess').classList.add('hidden');
  document.getElementById('bookingModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('bookingModal').classList.add('hidden');
}

// -------------------------------------------------------------
// SUBMIT FORM, STORE USER INFO, AND TRIGGER RAZORPAY / FREE PASS
// -------------------------------------------------------------
document.getElementById('confirmPassBtn')?.addEventListener('click', async () => {
  const fullName = document.getElementById('custName')?.value?.trim();
  const phone = document.getElementById('custPhone')?.value?.trim();
  const email = document.getElementById('custEmail')?.value?.trim();
  const whatsappConsent = document.getElementById('custConsent')?.checked ?? true;

  // Validation
  if (!fullName || !phone) {
    alert('Please enter your Name and WhatsApp Phone Number.');
    return;
  }
  if (phone.length < 10) {
    alert('Please provide a valid 10-digit mobile number.');
    return;
  }
  if (quantities.couple === 0 && quantities.stag === 0) {
    alert('Please choose at least 1 pass (Couple or Stag).');
    return;
  }

  const totalAmount = updateSubtotal();

  const payload = {
    user: {
      fullName,
      phone,
      email,
      whatsappConsent
    },
    booking: {
      venueId: activeBookingVenue.id,
      venueName: activeBookingVenue.name,
      couplePasses: quantities.couple,
      stagPasses: quantities.stag,
      totalAmount
    }
  };

  try {
    const res = await fetch('/api/create-pass-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error occurred');

    // Case 1: Subtotal is ₹0 (Free Entry Pass)
    if (data.isFree) {
      renderDigitalPass(data.passCode, activeBookingVenue.name);
      return;
    }

    // Case 2: Paid Pass via Razorpay Gateway
    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'PUB SCENE NAGPUR',
      description: `Entry Pass for ${activeBookingVenue.name}`,
      order_id: data.orderId,
      prefill: {
        name: fullName,
        contact: phone,
        email: email || ''
      },
      theme: { color: '#ff007f' },
      handler: async function (response) {
        // Send signature back to backend for verification
        const verifyRes = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            passCode: data.passCode
          })
        });

        const verifyResult = await verifyRes.json();
        if (verifyResult.status === 'success') {
          renderDigitalPass(data.passCode, activeBookingVenue.name);
        } else {
          alert('Payment verification failed. Please contact support.');
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error(err);
    alert('Unable to process pass: ' + err.message);
  }
});

function renderDigitalPass(passCode, venueName) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PUBSCENE_VALID_${passCode}`;
  
  document.getElementById('passCodeDisplay').innerText = passCode;
  document.getElementById('passVenueDisplay').innerText = venueName;
  document.getElementById('passQRCode').src = qrUrl;

  document.getElementById('modalBookingForm').classList.add('hidden');
  document.getElementById('modalPassSuccess').classList.remove('hidden');
}

document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);