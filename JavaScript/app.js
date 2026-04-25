const BKK = { lat: 13.7563, lng: 100.5018 };
const RADIUS = 10000; // 10km รอบกรุงเทพ
let service, placesCache = {}, currentPlace = null;

/* CLOCK */
function updateClock() {
  const el = document.getElementById('bkkTime');
  if (!el) return;
  const bkk = getBangkokTime ? getBangkokTime() : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const h = String(bkk.getHours()).padStart(2,'0');
  const m = String(bkk.getMinutes()).padStart(2,'0');
  el.textContent = '🕐 Bangkok ' + h + ':' + m;
}
setInterval(updateClock, 30000);

/* INIT */
function initApp() {
  updateClock();
  const mapDiv = document.createElement('div');
  const map = new google.maps.Map(mapDiv, { center: BKK, zoom: 12 });
  service = new google.maps.places.PlacesService(map);
}

/* TOAST */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* SEARCH */
function quickSearch(q) {
  document.getElementById('searchInput').value = q;
  doSearch();
}

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;

  if (!service) {
    showError('Google Maps API ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่');
    return;
  }

  showSkeleton();

  const req = {
    query: q + ' ร้านอาหาร กรุงเทพ',
    location: new google.maps.LatLng(BKK.lat, BKK.lng),
    radius: RADIUS,
    language: 'th'
  };

  service.textSearch(req, (results, status) => {
    console.log('Places status:', status, 'Results:', results?.length);
    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length) {
      renderCards(results, q);
    } else if (status === 'REQUEST_DENIED') {
      showError('API Key ถูกปฏิเสธ — กรุณาตรวจสอบว่าเปิดใช้ Places API ใน Google Cloud Console แล้ว');
    } else if (status === 'OVER_QUERY_LIMIT') {
      showError('เกิน quota ของ API Key กรุณาตรวจสอบการใช้งานใน Google Console');
    } else if (status === 'ZERO_RESULTS') {
      showEmpty(q);
    } else {
      showError('ค้นหาไม่สำเร็จ (status: ' + status + ') กรุณาลองใหม่อีกครั้ง');
    }
  });
}

/* UI STATES */
function showSkeleton() {
  document.getElementById('resultsBar').style.display = 'none';
  document.getElementById('grid').innerHTML = Array(6).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line xshort"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line xshort"></div>
      </div>
    </div>`).join('');
}

function showEmpty(q) {
  document.getElementById('resultsBar').style.display = 'none';
  document.getElementById('grid').innerHTML = `
    <div class="state-box">
      <div class="state-icon">🔍</div>
      <div class="state-title">ไม่พบผลลัพธ์สำหรับ "${q}"</div>
      <div class="state-sub">ลองค้นหาด้วยคำอื่น หรือกดแท็กด้านบน</div>
    </div>`;
}

function showError(msg) {
  document.getElementById('resultsBar').style.display = 'none';
  document.getElementById('grid').innerHTML = `
    <div class="state-box">
      <div class="state-icon">⚠️</div>
      <div class="state-title">เกิดข้อผิดพลาด</div>
      <div class="state-sub" style="color:#c0392b">${msg}</div>
      <div style="margin-top:1rem;font-size:.8rem;color:var(--text3)">
        💡 ตรวจสอบว่าเปิดใช้ <strong>Places API</strong> และ <strong>Maps JavaScript API</strong><br>
        ใน <a href="https://console.cloud.google.com" target="_blank" style="color:var(--orange)">Google Cloud Console</a> แล้ว
      </div>
    </div>`;
}

/* HELPERS */
function getPhotoUrl(place, maxW=600) {
  if (place.photos && place.photos.length > 0) {
    return place.photos[0].getUrl({ maxWidth: maxW });
  }
  return null;
}

function getBangkokTime() {
  const now = new Date();
  const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  return bkk;
}

function isOpenNowWithOffset(place) {
  if (!place.opening_hours) return null;

  let bkk;
  if (typeof place.utc_offset_minutes !== 'undefined') {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    bkk = new Date(utc + place.utc_offset_minutes * 60000);
  } else {
    bkk = getBangkokTime();
  }

  if (place.opening_hours.periods && place.opening_hours.periods.length > 0) {
    const dayOfWeek = bkk.getDay();
    const currentTime = bkk.getHours() * 100 + bkk.getMinutes();
    const periods = place.opening_hours.periods;

    if (periods.length === 1 && periods[0].open?.time === '0000' && !periods[0].close) return true;

    for (const period of periods) {
      if (!period.open || !period.close) continue;
      const openDay = period.open.day;
      const closeDay = period.close.day;
      const openTime = parseInt(period.open.time);
      const closeTime = parseInt(period.close.time);

      if (openDay === dayOfWeek) {
        if (closeDay === dayOfWeek) {
          if (currentTime >= openTime && currentTime < closeTime) return true;
        } else {
          if (currentTime >= openTime) return true;
        }
      } else if (closeDay === dayOfWeek) {
        if (currentTime < closeTime) return true;
      }
    }
    return false;
  }

  if (typeof place.opening_hours.open_now !== 'undefined') {
    return place.opening_hours.open_now;
  }
  return null;
}

function isOpenNow(place) {
  if (!place.opening_hours) return null;
  if (place.opening_hours.periods && place.opening_hours.periods.length > 0) {
    const bkk = getBangkokTime();
    const dayOfWeek = bkk.getDay();
    const currentTime = bkk.getHours() * 100 + bkk.getMinutes();
    const periods = place.opening_hours.periods;

    if (periods.length === 1 && periods[0].open && periods[0].open.time === '0000' && !periods[0].close) {
      return true;
    }

    for (const period of periods) {
      if (!period.open || !period.close) continue;
      const openDay = period.open.day;
      const closeDay = period.close.day;
      const openTime = parseInt(period.open.time);
      const closeTime = parseInt(period.close.time);

      if (openDay === dayOfWeek) {
        if (closeDay === dayOfWeek) {
          if (currentTime >= openTime && currentTime < closeTime) return true;
        } else {
          if (currentTime >= openTime) return true;
        }
      } else if (closeDay === dayOfWeek) {
        if (currentTime < closeTime) return true;
      }
    }
    return false;
  }
  if (typeof place.opening_hours.open_now !== 'undefined') {
    return place.opening_hours.open_now;
  }
  return place.opening_hours.isOpen();
}

/* RENDER CARDS */
function renderCards(places, q) {
  const bar = document.getElementById('resultsBar');
  bar.style.display = 'flex';
  document.getElementById('resultsTitle').textContent = `ผลการค้นหา "${q}" ในกรุงเทพ`;
  document.getElementById('resultsCount').innerHTML = `พบ <strong>${places.length}</strong> ร้าน`;

  const grid = document.getElementById('grid');
  grid.innerHTML = places.map((p, i) => {
    const photo = getPhotoUrl(p);
    const openBadge = `<div class="card-open-badge" id="badge-${p.place_id}" style="display:none"></div>`;
    const ratingBadge = p.rating
      ? `<div class="card-rating-badge">★ ${p.rating}</div>` : '';
    const imgContent = photo
      ? `<img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">
         ${openBadge}${ratingBadge}`
      : `<div class="no-img">🍽️<span>ไม่มีรูปภาพ</span></div>${openBadge}${ratingBadge}`;
    const types = (p.types||[]).filter(t=>!['point_of_interest','establishment','food'].includes(t))
      .slice(0,1).map(t=>thaiType(t)).join('');

    return `
      <div class="menu-card" style="animation-delay:${i*0.05}s" onclick="openModal('${p.place_id}')">
        <div class="card-img">${imgContent}</div>
        <div class="card-body">
          <div class="card-type">${types || 'ร้านอาหาร'}</div>
          <div class="card-name">${p.name}</div>
          <div class="card-addr">📍 ${p.formatted_address || p.vicinity || '-'}</div>
          <div class="card-footer">
            <div class="card-reviews">รีวิว <strong>${p.user_ratings_total || 0}</strong> รายการ</div>
            <a class="card-map-btn" href="https://www.google.com/maps/place/?q=place_id:${p.place_id}" target="_blank" onclick="event.stopPropagation()">🗺 Maps</a>
          </div>
        </div>
      </div>`;
  }).join('');

  // cache
  places.forEach(p => { placesCache[p.place_id] = p; });

  // โหลดสถานะเปิด/ปิดจาก getDetails ทีละร้าน (ไม่บล็อก UI)
  places.forEach((p, i) => {
    setTimeout(() => loadOpenStatus(p.place_id), i * 120);
  });
}

function loadOpenStatus(placeId) {
  service.getDetails({
    placeId,
    fields: ['opening_hours', 'utc_offset_minutes']
  }, (detail, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !detail) return;
    if (placesCache[placeId]) {
      placesCache[placeId].opening_hours = detail.opening_hours;
      placesCache[placeId].utc_offset_minutes = detail.utc_offset_minutes;
    }
    const badge = document.getElementById('badge-' + placeId);
    if (!badge) return;
    const openNow = isOpenNowWithOffset(detail);
    if (openNow === null) return;
    badge.textContent = openNow ? 'เปิดอยู่' : 'ปิดแล้ว';
    badge.className = 'card-open-badge ' + (openNow ? 'open-yes' : 'open-no');
    badge.style.display = '';
  });
}

/* UTILS */
function thaiType(t) {
  const map = {
    restaurant:'ร้านอาหาร', cafe:'คาเฟ่', bar:'บาร์',
    bakery:'เบเกอรี่', meal_takeaway:'อาหารซื้อกลับ',
    meal_delivery:'ส่งอาหาร', food:'อาหาร',
    night_club:'ไนท์คลับ', lodging:'ที่พัก',
  };
  return map[t] || t.replace(/_/g,' ');
}

function getDayName(d) {
  return ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][d];
}

/* MODAL */
function openModal(placeId) {
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('mImg').innerHTML = `
    <button class="modal-close" onclick="closeModalDirect()">✕</button>
    <div class="no-img">⏳</div>`;
  document.getElementById('mBody').innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text3)">กำลังโหลดข้อมูล...</div>`;

  if (placesCache[placeId] && placesCache[placeId]._detail) {
    renderModal(placesCache[placeId]);
    return;
  }

  service.getDetails({
    placeId,
    fields: ['name','rating','user_ratings_total','photos','formatted_address',
             'formatted_phone_number','opening_hours','website','url',
             'types','price_level','reviews','geometry']
  }, (place, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      place._detail = true;
      placesCache[placeId] = place;
      currentPlace = place;
      renderModal(place);
    }
  });
}

function renderModal(p) {
  const photo = getPhotoUrl(p, 800);
  const openNow = isOpenNowWithOffset(p);

  document.getElementById('mImg').innerHTML = `
    <button class="modal-close" onclick="closeModalDirect()">✕</button>
    ${photo ? `<img src="${photo}" alt="${p.name}">` : `<div class="no-img">🍽️</div>`}
    <div class="modal-img-overlay"></div>
    <div class="modal-img-text">
      <div class="modal-img-type">${(p.types||[]).filter(t=>!['point_of_interest','establishment'].includes(t)).slice(0,2).map(thaiType).join(' · ')}</div>
      <div class="modal-img-name">${p.name}</div>
    </div>`;

  const priceLevel = p.price_level !== undefined
    ? ['','฿','฿฿','฿฿฿','฿฿฿฿'][p.price_level] || '-' : '-';

  const openLabel = openNow === null ? '<span style="color:var(--text3)">ไม่ทราบเวลา</span>'
    : openNow ? '<span class="modal-open open-yes">🟢 เปิดอยู่ตอนนี้</span>'
              : '<span class="modal-open open-no">🔴 ปิดแล้ว</span>';

  let hoursHTML = '';
  if (p.opening_hours && p.opening_hours.weekday_text) {
    const today = new Date().getDay();
    hoursHTML = `
      <div class="sec-title">เวลาเปิด-ปิด</div>
      <div class="hours-list">
        ${p.opening_hours.weekday_text.map((row, i) => {
          const isToday = i === (today === 0 ? 6 : today - 1);
          return `<div class="hours-row ${isToday ? 'hours-today' : ''}">
            <span class="hours-day">${row.split(':')[0]}</span>
            <span class="hours-time">${row.split(/:(.*)/s)[1]?.trim() || '-'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  let reviewsHTML = '';
  if (p.reviews && p.reviews.length) {
    const topReview = p.reviews[0];
    reviewsHTML = `
      <div class="sec-title">รีวิวล่าสุด</div>
      <div style="background:var(--orange-light);border-radius:12px;padding:.85rem;margin-bottom:1.3rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
          <img src="${topReview.profile_photo_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">
          <span style="font-size:.82rem;font-weight:600;color:var(--text)">${topReview.author_name}</span>
          <span style="color:#FFD700;font-size:.8rem">${'★'.repeat(topReview.rating)}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text2);line-height:1.55">${topReview.text?.slice(0,180) || ''}${(topReview.text?.length||0)>180?'…':''}</div>
      </div>`;
  }

  document.getElementById('mBody').innerHTML = `
    <div class="modal-rating-row">
      <div class="modal-rating">${p.rating || '-'}</div>
      <div>
        <div class="modal-stars">${'★'.repeat(Math.round(p.rating||0))}${'☆'.repeat(5-Math.round(p.rating||0))}</div>
        <div class="modal-reviews">${p.user_ratings_total || 0} รีวิว</div>
      </div>
      ${openLabel}
    </div>

    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-lbl">ที่อยู่</div>
        <div class="detail-val">${p.formatted_address || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">เบอร์โทร</div>
        <div class="detail-val">${p.formatted_phone_number || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">ระดับราคา</div>
        <div class="detail-val" style="font-size:1.1rem;color:var(--orange)">${priceLevel || 'ไม่ระบุ'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">ประเภท</div>
        <div class="detail-val">${(p.types||[]).filter(t=>!['point_of_interest','establishment','food'].includes(t)).slice(0,2).map(thaiType).join(', ') || 'ร้านอาหาร'}</div>
      </div>
    </div>

    ${hoursHTML}
    ${reviewsHTML}

    <div class="action-row">
      <a class="action-btn btn-primary" href="${p.url || '#'}" target="_blank">🗺 เปิดใน Google Maps</a>
      ${p.website ? `<a class="action-btn btn-secondary" href="${p.website}" target="_blank">🌐 เว็บไซต์ร้าน</a>` : ''}
      ${p.formatted_phone_number ? `<a class="action-btn btn-secondary" href="tel:${p.formatted_phone_number}">📞 โทร</a>` : ''}
    </div>
  `;
}

function closeModal(e) { if (e.target === document.getElementById('overlay')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('overlay').classList.remove('open'); document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });