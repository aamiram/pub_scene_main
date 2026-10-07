function renderVenues(items) {
  const grid = document.getElementById('venuesGrid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `<div class="col-span-4 text-center text-gray-500 py-12">No parties found in this category.</div>`;
    return;
  }

  grid.innerHTML = items.map(v => `
    <div class="border-glow bg-[#100a22] rounded-2xl overflow-hidden flex flex-col justify-between group shadow-lg">
      <div class="relative h-56 overflow-hidden">
        <img src="${v.image}" alt="${v.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <span class="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-[10px] font-bold text-[#00e5ff] px-2 py-0.5 rounded border border-[#00e5ff]/30">
          ${v.areaName}
        </span>
        <span class="absolute top-2 right-2 bg-[#ff007f] text-white text-[10px] font-bold px-2 py-0.5 rounded">
          ★ ${v.rating}
        </span>
      </div>

      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h4 class="text-sm font-bold text-white group-hover:text-[#00e5ff] transition-colors leading-snug">${v.name}</h4>
          <p class="text-[11px] text-[#ff007f] mt-0.5">${v.genre}</p>
          <p class="text-[11px] text-gray-400 mt-2 bg-[#170e30] p-1.5 rounded border border-purple-900/30">
            <i class="fa-solid fa-gift text-[#00e5ff] mr-1"></i> ${v.offerText}
          </p>
        </div>

        <div class="mt-4 pt-3 border-t border-purple-900/40 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-gray-400 block uppercase">From</span>
            <span class="text-xs font-bold text-[#00e5ff]">₹${v.coverPrice}</span>
          </div>
          <button onclick="openBookingModal('${v.id}')" class="btn-neon-action text-[11px] font-bold px-3 py-1.5 rounded-full">
            Book now
          </button>
        </div>
      </div>
    </div>
  `).join('');
}