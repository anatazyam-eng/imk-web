(() => {
  'use strict';

  const app = document.getElementById('app');
  const toastRegion = document.getElementById('toast-region');
  const KEYS = {
    session: 'SiparkUB.session.v1',
    vehicles: 'SiparkUB.vehicles.v1',
    parking: 'SiparkUB.parking.v1',
    history: 'SiparkUB.history.v1',
  };
  const read = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; }
    catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* demo can still run without storage */ } };
  const now = () => new Date();
  const money = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number || 0);
  const dateText = (date = now()) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  const timeText = (date = now()) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date)).replace('.', ':');
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const svgBrand = '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 18.5V9.3L12 5l7 4.3v9.2h-5v-5h-4v5H5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.8 10.1 12 4.8l8.2 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
  const brand = `<a class="brand" href="#/login" aria-label="SiparkUB beranda">${svgBrand}<span><span class="brand-name">SiparkUB</span><span class="brand-caption">Sistem Parkir Kampus</span></span></a>`;
  const defaults = {
    session: null,
    vehicles: [
      { id: 'v-1', plate: 'BM 1234 KS', kind: 'Motor', brand: 'Honda Vario', color: 'Hitam', primary: true },
      { id: 'v-2', plate: 'BM 2087 AB', kind: 'Motor', brand: 'Yamaha NMAX', color: 'Biru', primary: false },
    ],
    parking: null,
    history: [
      { id: 'TRX-251117-032', date: '2026-11-17T09:12:00', plate: 'BM 1234 KS', zone: 'Area A - A12', duration: '2 jam 18 menit', fee: 5000, status: 'Selesai' },
      { id: 'TRX-251116-019', date: '2026-11-16T08:31:00', plate: 'BM 1234 KS', zone: 'Area B - B04', duration: '3 jam 42 menit', fee: 7000, status: 'Selesai' },
      { id: 'TRX-251114-008', date: '2026-11-14T10:05:00', plate: 'BM 2087 AB', zone: 'Area A - A09', duration: '1 jam 12 menit', fee: 3000, status: 'Selesai' },
    ],
  };
  let state = {
    session: read(KEYS.session, defaults.session),
    vehicles: read(KEYS.vehicles, defaults.vehicles),
    parking: read(KEYS.parking, defaults.parking),
    history: read(KEYS.history, defaults.history),
    role: 'student',
    selectedSlot: null,
    modal: null,
    verification: null,
    filter: 'Semua',
  };
  let toastTimer;

  function saveState() {
    write(KEYS.session, state.session);
    write(KEYS.vehicles, state.vehicles);
    write(KEYS.parking, state.parking);
    write(KEYS.history, state.history);
  }
  function go(route) {
    state.modal = null;
    if (!state.session && !['login', 'register', 'forgot'].includes(route)) route = 'login';
    location.hash = `#/${route}`;
    render();
  }
  function toast(message, kind = 'success') {
    clearTimeout(toastTimer);
    toastRegion.innerHTML = `<div class="toast ${kind === 'error' ? 'error' : ''}"><span class="toast-icon">${kind === 'error' ? '!' : '✓'}</span><span>${escapeHtml(message)}</span></div>`;
    toastTimer = setTimeout(() => { toastRegion.innerHTML = ''; }, 3400);
  }
  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    return raw || (state.session ? (state.session.role === 'staff' ? 'staff-dashboard' : 'dashboard') : 'login');
  }
  function updateRouteOnLoad() {
    const route = currentRoute();
    if (!state.session && !['login', 'register', 'forgot'].includes(route)) location.hash = '#/login';
    if (state.session && ['login', 'register', 'forgot'].includes(route)) location.hash = `#/${state.session.role === 'staff' ? 'staff-dashboard' : 'dashboard'}`;
  }
  function showModal(type, extra = {}) { state.modal = { type, ...extra }; render(); }
  function pageTitle(kicker, title, subtitle, actions = '') {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
  }
  function card(title, content, options = {}) {
    const description = options.description ? `<p>${options.description}</p>` : '';
    const action = options.action || '';
    return `<section class="card card-pad"><div class="card-head"><div><h2>${title}</h2>${description}</div>${action}</div>${content}</section>`;
  }
  function stat(label, value, foot, icon, tone = '') {
    return `<article class="card stat-card"><span class="stat-icon ${tone}">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }
  function badge(status, tone = '') { return `<span class="badge ${tone}">${status}</span>`; }
  function qrSvg(seed = 'SiparkUB-DEMO') {
    const size = 21;
    let hash = 0;
    for (const ch of seed) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    const cells = [];
    const finder = (x, y) => {
      for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
        const edge = row === 0 || row === 6 || col === 0 || col === 6;
        const center = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        if (edge || center) cells.push(`<rect x="${x + col}" y="${y + row}" width="1" height="1"/>`);
      }
    };
    finder(0, 0); finder(14, 0); finder(0, 14);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
      const bit = Math.abs(Math.sin((x + 1) * 19 + (y + 3) * 7 + hash) * 10000) % 1;
      if (bit > .49) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    return `<svg viewBox="-1 -1 23 23" role="img" aria-label="QR demo parkir"><rect x="-1" y="-1" width="23" height="23" rx="1" fill="#fff"/><g fill="#16355f">${cells.join('')}</g></svg>`;
  }
  function qrCard(code = 'SiparkUB-261118-042') {
    return `<div class="qr-card"><div><span class="qr-code">${qrSvg(code)}</span><div><div class="cell-main">QR tiket</div><div class="qr-label">Tunjukkan ke petugas saat masuk</div></div></div></div>`;
  }
  function campusArt() {
    return `<div class="campus-art" aria-hidden="true"><div class="campus-building"><div class="campus-windows"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="campus-tree one"></span><span class="campus-tree two"></span><span class="campus-tree three"></span><div class="campus-path"></div></div>`;
  }
  function renderAuth(route) {
    const isRegister = route === 'register';
    const isForgot = route === 'forgot';
    const isLogin = !isRegister && !isForgot;
    const title = isRegister ? 'Daftar akun SiparkUB' : isForgot ? 'Atur ulang kata sandi' : state.role === 'staff' ? 'Masuk sebagai petugas' : 'Masuk ke akun Anda';
    const intro = isRegister ? 'Isi data singkat di bawah ini untuk mulai menggunakan parkir kampus.' : isForgot ? 'Masukkan email yang terdaftar. Kami akan menampilkan konfirmasi permintaan reset.' : state.role === 'staff' ? 'Gunakan akun petugas untuk memverifikasi kendaraan dan mengelola area parkir.' : 'Selamat datang kembali. Masuk untuk melihat ketersediaan parkir kampus.';
    const registerFields = `<div class="field"><label for="fullName">Nama lengkap</label><input id="fullName" name="fullName" autocomplete="name" placeholder="Nama sesuai kartu mahasiswa" required /></div><div class="field"><label for="studentId">NIM</label><input id="studentId" name="studentId" placeholder="Contoh: 230411015" required /></div><div class="field"><label for="email">Email kampus</label><input id="email" name="email" type="email" autocomplete="email" placeholder="nama@kampus.ac.id" required /></div><div class="grid grid-2"><div class="field"><label for="phone">Nomor telepon</label><input id="phone" name="phone" type="tel" placeholder="08xxxxxxxxxx" required /></div><div class="field"><label for="plate">Plat kendaraan</label><input id="plate" name="plate" placeholder="BM 1234 KS" required /></div></div><div class="field"><label for="password">Buat kata sandi</label><div class="password-wrap"><input id="password" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Minimal 6 karakter" required /><button class="text-link" type="button" data-action="toggle-password">Lihat</button></div></div>`;
    const loginFields = `<div class="field"><label for="identity">${state.role === 'staff' ? 'ID petugas atau email' : 'NIM atau email'}</label><input id="identity" name="identity" autocomplete="username" placeholder="${state.role === 'staff' ? 'petugas@kampus.ac.id' : 'nama@kampus.ac.id'}" required /></div><div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><label for="password">Kata sandi</label><button class="text-link" type="button" data-route="forgot">Lupa kata sandi?</button></div><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required /><button class="text-link" type="button" data-action="toggle-password">Lihat</button></div></div><div class="form-row"><label class="checkline"><input type="checkbox" name="remember" checked /> Ingat saya</label><span class="muted">Akses aman kampus</span></div>`;
    const roleSwitch = isLogin ? `<div class="role-switch" role="tablist" aria-label="Jenis akun"><button type="button" role="tab" aria-selected="${state.role === 'student'}" class="${state.role === 'student' ? 'active' : ''}" data-role="student">Mahasiswa</button><button type="button" role="tab" aria-selected="${state.role === 'staff'}" class="${state.role === 'staff' ? 'active' : ''}" data-role="staff">Petugas</button></div>` : '';
    const demo = isLogin ? `<div class="divider">AKUN DEMO</div><div class="demo-hint"><strong>Demo interaktif.</strong> Gunakan email dan kata sandi apa saja untuk masuk. Tombol di bawah mengisi akun contoh secara otomatis.<br /><button class="text-link" type="button" data-action="demo-fill">Isi akun demo ${state.role === 'staff' ? 'petugas' : 'mahasiswa'}</button></div>` : '';
    return `<main class="auth-page"><aside class="auth-aside">${brand}<div class="auth-aside-content"><div class="eyebrow" style="color:#83b1ff">PARKIR KAMPUS LEBIH MUDAH</div><h1>Parkir tenang,<br />kuliah nyaman.</h1><p>Temukan slot parkir, simpan tiket digital, dan selesaikan perjalanan kampus dengan lebih praktis.</p>${campusArt()}<div class="campus-caption"><span><i class="dot"></i> Terhubung dengan area parkir kampus</span><span>01 / 03</span></div></div><div class="auth-foot">© 2026 SiparkUB Parkir Kampus · Akses khusus civitas akademika</div></aside><section class="auth-main"><div class="auth-card"><div class="auth-mobile-brand">${brand}</div><div class="auth-topline"><span>${isRegister ? 'Sudah punya akun?' : 'SiparkUB · Portal parkir kampus'}</span>${isRegister ? '<button class="text-link" type="button" data-route="login">Masuk</button>' : ''}</div><div class="eyebrow">${isRegister ? 'AKUN BARU' : isForgot ? 'BANTUAN AKUN' : 'SELAMAT DATANG'}</div><h2>${title}</h2><p class="auth-intro">${intro}</p>${roleSwitch}<div class="inline-message" id="auth-message"></div><form data-form="${isRegister ? 'register' : isForgot ? 'forgot' : 'login'}">${isRegister ? registerFields : isForgot ? '<div class="field"><label for="email">Email terdaftar</label><input id="email" name="email" type="email" autocomplete="email" placeholder="nama@kampus.ac.id" required /></div>' : loginFields}<button class="button button-primary button-block" type="submit">${isRegister ? 'Buat akun' : isForgot ? 'Kirim instruksi reset' : 'Masuk'} <span aria-hidden="true">→</span></button></form>${demo}<div class="auth-bottom">${isRegister ? 'Dengan mendaftar, Anda menyetujui aturan penggunaan parkir kampus.' : isForgot ? '<button class="text-link" type="button" data-route="login">Kembali ke halaman masuk</button>' : `Belum punya akun? <button class="text-link" type="button" data-route="register">Daftar sekarang</button>`}</div></div></section></main>`;
  }
  function navItems(route) {
    const staff = state.session?.role === 'staff';
    const items = staff ? [
      ['staff-dashboard', 'Ringkasan'], ['verify-entry', 'Verifikasi tiket'], ['verify-exit', 'Kendaraan keluar'], ['users', 'Pengguna & kendaraan'], ['reports', 'Laporan'], ['profile', 'Profil'],
    ] : [
      ['dashboard', 'Beranda'], ['parking', 'Cari parkir'], ['ticket', 'Tiket & QR'], ['history', 'Riwayat'], ['vehicles', 'Kendaraan'], ['profile', 'Profil'],
    ];
    return items.map(([path, label]) => `<a href="#/${path}" class="${route === path ? 'active' : ''}">${label}</a>`).join('');
  }
  function renderHeader(route) {
    const person = state.session || { name: 'Pengguna Lentera', id: 'Akun demo', role: 'student' };
    const initials = (person.name || 'PL').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const home = person.role === 'staff' ? 'staff-dashboard' : 'dashboard';
    const homeBrand = brand.replace('#/login', `#/${home}`);
    return `<header class="site-header"><div class="header-inner">${homeBrand}<nav class="main-nav" aria-label="Navigasi utama">${navItems(route)}</nav><div class="header-user"><div class="avatar">${escapeHtml(initials)}</div><div class="header-user-name">${escapeHtml(person.name)}<small>${person.role === 'staff' ? 'Petugas parkir' : 'Mahasiswa'}</small></div><button class="button button-secondary button-small" type="button" data-action="logout">Keluar</button></div></div></header>`;
  }
  function renderShell(route, content) {
    return `${renderHeader(route)}<main class="shell"><div class="page-wrap">${content}</div><footer class="site-footer">LENTERA · Parkir kampus yang tertib dan nyaman · Demo antarmuka lokal</footer></main>${renderModal()}`;
  }
  function homeContent() {
    const active = state.parking;
    const parked = active && active.status === 'Parkir aktif';
    const totalSpots = 48;
    const freeSpots = 13;
    const action = parked ? '<button class="button button-primary" type="button" data-route="ticket">Lihat tiket aktif →</button>' : '<button class="button button-primary" type="button" data-route="parking">Pesan slot parkir →</button>';
    const activeContent = parked ? `<div class="parking-summary"><div><span class="badge success">Parkir aktif</span><h3>${escapeHtml(active.plate)}</h3><div class="muted small">${escapeHtml(active.kind)} · ${escapeHtml(active.vehicle)}</div><div class="parking-meta"><div class="meta-item"><span>Lokasi parkir</span><strong>${escapeHtml(active.zone)}</strong></div><div class="meta-item"><span>Mulai parkir</span><strong>${dateText(active.startedAt)} · ${timeText(active.startedAt)}</strong></div><div class="meta-item"><span>Kode tiket</span><strong>${escapeHtml(active.code)}</strong></div><div class="meta-item"><span>Estimasi biaya</span><strong>${money(active.fee || 3000)} / jam pertama</strong></div></div><div class="parking-actions"><button class="button button-secondary button-small" type="button" data-route="ticket">Tampilkan QR</button><button class="button button-danger button-small" type="button" data-action="checkout">Akhiri parkir</button></div></div>${qrCard(active.code)}</div>` : `<div class="empty-state"><div class="empty-icon">⌖</div><div class="cell-main">Belum ada parkir aktif</div><div>Pesan slot lebih dulu, lalu tunjukkan QR tiket kepada petugas.</div><div style="margin-top:15px">${action}</div></div>`;
    const historyRows = state.history.slice(0, 3).map((item) => `<div class="list-row"><div><div class="list-row-title">${escapeHtml(item.plate)} <span class="muted">· ${escapeHtml(item.zone)}</span></div><div class="list-row-sub">${dateText(item.date)} · ${escapeHtml(item.duration)}</div></div><div style="text-align:right"><div class="cell-main">${money(item.fee)}</div><div class="list-row-sub">${badge(item.status, 'success')}</div></div></div>`).join('') || '<div class="empty-state">Belum ada riwayat parkir.</div>';
    const firstVehicle = state.vehicles.find((vehicle) => vehicle.primary) || state.vehicles[0];
    return `${pageTitle('DASHBOARD MAHASISWA', `Halo, ${escapeHtml((state.session?.name || 'Pengguna').split(' ')[0])}`, 'Semua kebutuhan parkir kampus Anda ada di satu tempat.', action)}<div class="grid grid-4">${stat('Parkir hari ini', parked ? '1' : '0', parked ? 'Kendaraan sedang berada di area kampus' : 'Anda belum memulai parkir hari ini', '⌖')}${stat('Slot tersedia', freeSpots, `dari ${totalSpots} slot · Area A & B`, '▦')}${stat('Kendaraan terdaftar', state.vehicles.length, 'Kelola kendaraan yang sering digunakan', '♧')}${stat('Transaksi bulan ini', state.history.length, 'Riwayat parkir tersimpan di akun', '↗')}</div><div class="layout-main-aside" style="margin-top:15px"><div class="stack">${card('Status parkir saya', activeContent, { description: parked ? 'Pantau perjalanan parkir yang sedang berlangsung.' : 'Tiket dan lokasi parkir akan tampil di sini.' })}${card('Aktivitas terbaru', `<div>${historyRows}</div><div style="margin-top:12px"><button class="text-link" type="button" data-route="history">Lihat semua riwayat →</button></div>`, { action: '<span class="badge blue">Terbaru</span>' })}</div><div class="stack">${card('Ketersediaan area', `<div class="list-row"><div><div class="list-row-title">Area A · Gedung Utama</div><div class="list-row-sub">18 dari 24 slot tersedia</div></div>${badge('75%', 'success')}</div><div class="progress"><i style="width:25%"></i></div><div class="list-row" style="margin-top:14px"><div><div class="list-row-title">Area B · Perpustakaan</div><div class="list-row-sub">7 dari 24 slot tersedia</div></div>${badge('29%', 'warning')}</div><div class="progress"><i style="width:71%;background:#e8a638"></i></div><div style="margin-top:15px"><button class="button button-quiet button-small" type="button" data-route="parking">Pilih area parkir</button></div>`, { description: 'Kapasitas saat ini' })}${card('Kendaraan utama', firstVehicle ? `<div class="vehicle-card" style="padding:0;border:0"><div class="vehicle-icon">♧</div><h3>${escapeHtml(firstVehicle.plate)}</h3><p>${escapeHtml(firstVehicle.brand)} · ${escapeHtml(firstVehicle.color)}</p><div style="margin-top:13px">${badge(firstVehicle.primary ? 'Kendaraan utama' : 'Terdaftar', 'blue')}</div><div style="margin-top:13px"><button class="text-link" type="button" data-route="vehicles">Kelola kendaraan →</button></div></div>` : '<div class="empty-state">Tambahkan kendaraan untuk memesan parkir.</div>')}</div></div>`;
  }
  function parkingContent() {
    const spots = [
      { code: 'A01', state: 'available' }, { code: 'A02', state: 'occupied' }, { code: 'A03', state: 'available' }, { code: 'A04', state: 'available' },
      { code: 'A05', state: 'occupied' }, { code: 'A06', state: 'available' }, { code: 'A07', state: 'occupied' }, { code: 'A08', state: 'available' },
      { code: 'A09', state: 'available' }, { code: 'A10', state: 'available' }, { code: 'B01', state: 'occupied' }, { code: 'B02', state: 'available' },
    ];
    const slotMarkup = spots.map((slot) => `<button type="button" class="slot ${slot.state} ${state.selectedSlot === slot.code ? 'selected' : ''}" data-slot="${slot.code}" ${slot.state === 'occupied' ? 'disabled' : ''}><strong>${slot.code}</strong><span>${slot.state === 'occupied' ? 'Terisi' : 'Tersedia'}</span></button>`).join('');
    const vehicles = state.vehicles.map((vehicle) => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.brand)}</option>`).join('');
    return `${pageTitle('PEMESANAN SLOT', 'Cari tempat parkir', 'Pilih area, kendaraan, dan slot yang tersedia untuk perjalanan Anda.')}<div class="layout-main-aside"><div class="stack">${card('Pilih lokasi', `<form data-form="find-parking"><div class="grid grid-2"><div class="field"><label for="parking-area">Area parkir</label><select id="parking-area" name="area"><option>Area A · Gedung Utama</option><option>Area B · Perpustakaan</option></select></div><div class="field"><label for="parking-vehicle">Kendaraan</label><select id="parking-vehicle" name="vehicle" required>${vehicles || '<option value="">Tambahkan kendaraan terlebih dahulu</option>'}</select></div></div><div class="field"><label for="parking-time">Perkiraan durasi</label><select id="parking-time" name="duration"><option value="2">Sekitar 1-2 jam</option><option value="4">Sekitar 3-4 jam</option><option value="8">Lebih dari 4 jam</option></select></div><div class="notice"><span>ⓘ</span><span>Pemesanan demo tidak memungut biaya. Tarif awal parkir adalah <strong>Rp3.000 untuk jam pertama</strong>, lalu Rp2.000 per jam berikutnya.</span></div><input type="hidden" name="slot" value="${escapeHtml(state.selectedSlot || '')}" /><div style="margin-top:14px"><button class="button button-primary" type="submit" ${state.parking?.status === 'Parkir aktif' ? 'disabled' : ''}>${state.parking?.status === 'Parkir aktif' ? 'Selesaikan parkir aktif terlebih dahulu' : 'Pesan slot terpilih →'}</button></div></form>`, { description: 'Reservasi slot untuk hari ini' })}${card('Peta slot · Area A', `<div class="toolbar"><span class="badge success">Tersedia</span><span class="badge danger">Terisi</span><span class="badge blue">Pilihan Anda</span></div><div class="slot-list">${slotMarkup}</div><p class="muted tiny" style="margin:12px 0 0">Pilih kotak hijau untuk melihat konfirmasi pemesanan. Status slot merupakan data demo.</p>`, { description: 'Gedung Utama · akses dari gerbang timur' })}</div><div class="stack">${card('Ringkasan area', `<div class="list-row"><div><div class="list-row-title">Kapasitas total</div><div class="list-row-sub">Motor dan mobil</div></div><strong>24 slot</strong></div><div class="list-row"><div><div class="list-row-title">Tersedia sekarang</div><div class="list-row-sub">Area A · Gedung Utama</div></div>${badge('18 slot', 'success')}</div><div class="list-row"><div><div class="list-row-title">Jam operasional</div><div class="list-row-sub">Senin - Jumat</div></div><strong class="small">06.00 - 21.00</strong></div>`, { description: 'Informasi parkir kampus' })}${card('Cara memesan', `<ul class="list-bullet"><li>Pilih area dan kendaraan yang akan digunakan.</li><li>Ketuk salah satu slot yang tersedia.</li><li>Konfirmasi. QR tiket Anda siap ditunjukkan di gerbang.</li></ul>`)}</div></div>`;
  }
  function ticketContent() {
    if (!state.parking) return `${pageTitle('TIKET DIGITAL', 'Tiket & QR', 'Semua tiket parkir tersimpan di halaman ini.')}<div class="card card-pad"><div class="empty-state"><div class="empty-icon">▦</div><div class="cell-main">Belum ada tiket aktif</div><div>Buat reservasi terlebih dahulu untuk mendapatkan tiket digital.</div><div style="margin-top:14px"><button class="button button-primary" type="button" data-route="parking">Cari slot parkir</button></div></div></div>`;
    const parking = state.parking;
    return `${pageTitle('TIKET DIGITAL', 'Tiket parkir saya', 'Simpan tiket ini dan tunjukkan kepada petugas di gerbang.', '<button class="button button-secondary" type="button" data-action="print-ticket">Cetak tiket</button>')}<div class="layout-main-aside"><div class="stack">${card('Tiket digital', `<div class="ticket-hero"><div><div class="eyebrow">KODE RESERVASI</div><div class="ticket-number">${escapeHtml(parking.code)}</div><div style="margin-top:9px">${badge(parking.status, parking.status === 'Parkir aktif' ? 'success' : 'blue')}</div></div><div class="muted small">${dateText(parking.startedAt)} · ${timeText(parking.startedAt)}</div></div><div class="parking-summary" style="margin-top:18px"><div><h3>${escapeHtml(parking.plate)}</h3><div class="muted small">${escapeHtml(parking.vehicle)} · ${escapeHtml(parking.kind)}</div><div class="parking-meta"><div class="meta-item"><span>Area parkir</span><strong>${escapeHtml(parking.zone)}</strong></div><div class="meta-item"><span>Tarif</span><strong>Rp3.000 jam pertama</strong></div><div class="meta-item"><span>Nama pemilik</span><strong>${escapeHtml(state.session?.name || 'Mahasiswa')}</strong></div><div class="meta-item"><span>Status akses</span><strong>${parking.status === 'Parkir aktif' ? 'Tiket siap digunakan' : 'Menunggu verifikasi'}</strong></div></div></div>${qrCard(parking.code)}</div><div class="notice warning" style="margin-top:17px"><span>!</span><span>QR ini adalah bagian dari demo antarmuka. Petugas dapat memasukkan kode tiket secara manual pada halaman verifikasi.</span></div>`, { description: 'Tunjukkan QR ini sebelum masuk area parkir' })}</div><div class="stack">${card('Petunjuk gerbang', `<ul class="list-bullet"><li>Perlambat kendaraan saat mendekati palang.</li><li>Tunjukkan QR tiket pada layar ponsel Anda.</li><li>Simpan tiket sampai perjalanan selesai.</li></ul>`)}</div></div>`;
  }
  function historyContent() {
    const rows = state.history.map((item) => `<tr><td><span class="cell-main">${escapeHtml(item.id)}</span><span class="cell-sub">${dateText(item.date)} · ${timeText(item.date)}</span></td><td>${escapeHtml(item.plate)}<span class="cell-sub">${escapeHtml(item.zone)}</span></td><td>${escapeHtml(item.duration)}</td><td>${money(item.fee)}</td><td>${badge(item.status, item.status === 'Selesai' ? 'success' : 'warning')}</td><td><button class="table-action" data-action="receipt" data-id="${escapeHtml(item.id)}">Lihat bukti</button></td></tr>`).join('');
    return `${pageTitle('AKTIVITAS AKUN', 'Riwayat parkir', 'Lihat tiket dan biaya parkir yang tercatat di akun Anda.', '<button class="button button-secondary" type="button" data-action="export-history">Unduh CSV</button>')}<div class="grid grid-3" style="margin-bottom:15px">${stat('Total kunjungan', state.history.length, 'Seluruh riwayat tersimpan', '↗')}${stat('Total biaya', money(state.history.reduce((sum, item) => sum + Number(item.fee || 0), 0)), 'Transaksi yang tercatat', 'Rp')}${stat('Status akun', 'Aktif', 'Parkir kampus siap digunakan', '✓')}</div><section class="card card-pad"><div class="card-head"><div><h2>Semua transaksi</h2><p>Riwayat aktivitas kendaraan Anda</p></div><select class="search-input" style="width:auto;min-height:34px" data-filter="history"><option>Semua</option><option>Selesai</option><option>Menunggu pembayaran</option></select></div><div class="table-wrap"><table><thead><tr><th>No. transaksi</th><th>Kendaraan & area</th><th>Durasi</th><th>Biaya</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="6"><div class="empty-state">Belum ada riwayat parkir.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function vehicleContent() {
    const cards = state.vehicles.map((vehicle) => `<article class="card vehicle-card"><div style="display:flex;align-items:center;justify-content:space-between"><span class="vehicle-icon">♧</span>${vehicle.primary ? badge('Utama', 'blue') : ''}</div><h3>${escapeHtml(vehicle.plate)}</h3><p>${escapeHtml(vehicle.brand)} · ${escapeHtml(vehicle.color)}</p><p style="margin-top:5px">Jenis: ${escapeHtml(vehicle.kind)}</p><div class="vehicle-actions"><button class="button button-secondary button-small" data-action="set-primary" data-id="${escapeHtml(vehicle.id)}" ${vehicle.primary ? 'disabled' : ''}>Jadikan utama</button><button class="button button-secondary button-small delete-vehicle" data-action="delete-vehicle" data-id="${escapeHtml(vehicle.id)}">Hapus</button></div></article>`).join('');
    return `${pageTitle('PENGATURAN KENDARAAN', 'Kendaraan saya', 'Daftarkan kendaraan yang akan digunakan untuk parkir kampus.', '<button class="button button-primary" type="button" data-action="add-vehicle">＋ Tambah kendaraan</button>')}<div class="grid grid-3">${cards || '<div class="card empty-state">Belum ada kendaraan terdaftar.</div>'}<button class="card vehicle-card" type="button" data-action="add-vehicle" style="min-height:190px;border-style:dashed;color:var(--blue);background:transparent"><span class="empty-icon">＋</span><span class="cell-main">Tambah kendaraan</span><span class="muted tiny">Motor atau mobil</span></button></div><div style="margin-top:16px">${card('Ketentuan data kendaraan', '<ul class="list-bullet"><li>Pastikan nomor polisi sesuai dengan kendaraan yang Anda gunakan.</li><li>Satu kendaraan dapat ditandai sebagai kendaraan utama.</li><li>Perubahan kendaraan tidak mengubah riwayat parkir sebelumnya.</li></ul>')}</div>`;
  }
  function profileContent() {
    const person = state.session || {};
    return `${pageTitle('PENGATURAN AKUN', 'Profil saya', 'Kelola informasi akun Lentera Anda.')}<div class="profile-grid"><section class="card card-pad"><div class="card-head"><div><h2>Informasi pribadi</h2><p>Data profil pada perangkat ini</p></div>${badge('Akun demo', 'blue')}</div><form data-form="profile"><div class="field"><label for="profile-name">Nama lengkap</label><input id="profile-name" name="name" value="${escapeHtml(person.name || '')}" required /></div><div class="field"><label for="profile-email">Email kampus</label><input id="profile-email" name="email" type="email" value="${escapeHtml(person.email || '')}" required /></div><div class="field"><label for="profile-id">NIM / ID petugas</label><input id="profile-id" name="identity" value="${escapeHtml(person.identity || '')}" /></div><div class="field"><label for="profile-phone">Nomor telepon</label><input id="profile-phone" name="phone" value="${escapeHtml(person.phone || '')}" /></div><button class="button button-primary" type="submit">Simpan perubahan</button></form></section><div class="stack">${card('Keamanan akun', `<div class="notice"><span>✓</span><span>Data demo disimpan di penyimpanan lokal browser Anda.</span></div><div style="margin-top:14px"><button class="button button-secondary button-small" data-action="logout">Keluar dari akun ini</button></div>`)}${card('Bantuan', '<p class="muted small" style="line-height:1.65">Jika mengalami kendala saat menggunakan parkir kampus, hubungi petugas di pos gerbang utama atau pengelola fasilitas kampus.</p>')}</div></div>`;
  }
  function renderStudent(route) {
    const map = { dashboard: homeContent, parking: parkingContent, ticket: ticketContent, history: historyContent, vehicles: vehicleContent, profile: profileContent };
    return renderShell(route, (map[route] || homeContent)());
  }
  function staffHome() {
    const activeCount = state.parking?.status === 'Parkir aktif' ? 23 : 22;
    const today = state.history.length + (state.parking?.status === 'Parkir aktif' ? 1 : 0);
    const activities = [
      ['BM 1234 KS', 'Masuk · Gerbang Utama', '09:14', 'success'], ['B 2087 AB', 'Tiket terverifikasi', '09:08', 'blue'], ['BM 7788 QZ', 'Kendaraan keluar', '08:52', 'success'],
    ].map(([plate, action, time, tone]) => `<div class="list-row"><div><div class="list-row-title">${plate}</div><div class="list-row-sub">${action}</div></div><div style="text-align:right">${badge(time, tone)}</div></div>`).join('');
    return `${pageTitle('DASHBOARD PETUGAS', `Selamat bertugas, ${escapeHtml((state.session?.name || 'Petugas').split(' ')[0])}`, 'Pantau aktivitas kendaraan dan kondisi area parkir.', '<button class="button button-primary" type="button" data-route="verify-entry">＋ Verifikasi tiket</button>')}<div class="grid grid-4">${stat('Kendaraan di area', activeCount, 'Dari 48 slot parkir tersedia', '⌖')}${stat('Transaksi hari ini', today, 'Aktivitas masuk dan keluar', '↗')}${stat('Slot tersedia', Math.max(0, 48 - activeCount), 'Gabungan Area A dan Area B', '▦')}${stat('Perlu diperiksa', '2', 'Data kendaraan butuh perhatian', '!', 'warning')}</div><div class="layout-main-aside" style="margin-top:15px"><div class="stack">${card('Aktivitas terbaru', activities, { description: 'Catatan operasional hari ini' })}${card('Kondisi area parkir', `<div class="list-row"><div><div class="list-row-title">Area A · Gedung Utama</div><div class="list-row-sub">18 dari 24 slot terisi</div></div>${badge('75%', 'warning')}</div><div class="progress"><i style="width:75%;background:#e8a638"></i></div><div class="list-row" style="margin-top:14px"><div><div class="list-row-title">Area B · Perpustakaan</div><div class="list-row-sub">11 dari 24 slot terisi</div></div>${badge('46%', 'success')}</div><div class="progress"><i style="width:46%"></i></div>`)}</div><div class="stack">${card('Akses cepat', `<div class="stack"><button class="button button-primary button-block" data-route="verify-entry">Verifikasi kendaraan masuk</button><button class="button button-secondary button-block" data-route="verify-exit">Proses kendaraan keluar</button><button class="button button-secondary button-block" data-route="users">Cari pengguna & kendaraan</button><button class="button button-secondary button-block" data-route="reports">Lihat laporan</button></div>`)}${card('Pengingat petugas', '<div class="notice warning"><span>!</span><span>Pastikan nomor polisi pada tiket sesuai dengan kendaraan sebelum membuka palang.</span></div>')}</div></div>`;
  }
  function verifyContent(isExit) {
    const mode = isExit ? 'keluar' : 'masuk';
    const result = state.verification ? `<div class="notice ${state.verification.found ? 'success' : 'danger'}" style="margin-top:14px"><span>${state.verification.found ? '✓' : '!'}</span><span>${state.verification.message}</span></div>` : '';
    const scanTitle = isExit ? 'Verifikasi kendaraan keluar' : 'Verifikasi tiket parkir';
    return `${pageTitle(isExit ? 'KENDARAAN KELUAR' : 'GERBANG MASUK', scanTitle, `Periksa QR atau masukkan kode tiket sebelum memproses kendaraan ${mode}.`)}<div class="layout-main-aside"><div class="stack">${card(isExit ? 'Cari tiket aktif' : 'Masukkan kode reservasi', `<form data-form="verify"><div class="field"><label for="ticket-code">Kode tiket atau nomor polisi</label><input id="ticket-code" name="code" autocomplete="off" placeholder="Contoh: LT-261118-042 atau BM 1234 KS" required /></div><div class="field"><label for="verify-action">Tindakan</label><select id="verify-action" name="action"><option value="${mode}">Validasi kendaraan ${mode}</option></select></div><button class="button button-primary" type="submit">Cari dan verifikasi →</button></form>${result}`, { description: 'Pencarian demo berbasis data tiket lokal' })}${card('Simulasi pemindai QR', `<div class="scan-panel"><div><div class="scan-icon">▦</div><h3>Pemindai siap digunakan</h3><p>Dalam implementasi penuh, kamera akan membaca QR tiket. Untuk demo ini, masukkan kode tiket secara manual di formulir.</p><button class="button button-quiet button-small" type="button" data-action="sample-code">Gunakan tiket contoh</button></div></div>`)}</div><div class="stack">${card('Alur pemeriksaan', `<ul class="list-bullet"><li>Periksa kode tiket pada layar pengguna.</li><li>Cocokkan nama, nomor polisi, dan area parkir.</li><li>${isExit ? 'Selesaikan tagihan sebelum kendaraan meninggalkan area.' : 'Pilih konfirmasi untuk mencatat kendaraan masuk.'}</li></ul>`)}${card('Info operasional', `<div class="list-row"><div class="list-row-title">Gerbang aktif</div><strong class="small">Gerbang Utama</strong></div><div class="list-row"><div class="list-row-title">Petugas</div><strong class="small">${escapeHtml(state.session?.name || 'Petugas')}</strong></div><div class="list-row"><div class="list-row-title">Waktu lokal</div><strong class="small">${timeText()}</strong></div>`)}</div></div>`;
  }
  function usersContent() {
    const known = [...state.vehicles.map((vehicle, index) => ({ name: index === 0 ? state.session?.name || 'Nadia Putri' : 'Pengguna Lentera', id: index === 0 ? state.session?.identity || '230411015' : '2304110' + (18 + index), plate: vehicle.plate, type: vehicle.kind, brand: vehicle.brand, status: index === 0 && state.parking?.status === 'Parkir aktif' ? 'Di area' : 'Terdaftar' }))];
    const rows = known.map((user) => `<tr><td><span class="cell-main">${escapeHtml(user.name)}</span><span class="cell-sub">${escapeHtml(user.id)}</span></td><td>${escapeHtml(user.plate)}<span class="cell-sub">${escapeHtml(user.brand)} · ${escapeHtml(user.type)}</span></td><td>${badge(user.status, user.status === 'Di area' ? 'warning' : 'success')}</td><td><button class="table-action" data-action="user-detail" data-id="${escapeHtml(user.plate)}">Lihat detail</button></td></tr>`).join('');
    return `${pageTitle('DATA KAMPUS', 'Pengguna & kendaraan', 'Cari identitas kendaraan dan status registrasinya.', '<button class="button button-secondary" type="button" data-action="export-users">Unduh CSV</button>')}<div class="grid grid-3" style="margin-bottom:15px">${stat('Pengguna terdaftar', '1.284', 'Akun kampus aktif', '♧')}${stat('Kendaraan aktif', '1.536', 'Motor dan mobil', '⌖')}${stat('Tiket hari ini', '87', 'Sudah diverifikasi', '▦')}</div><section class="card card-pad"><div class="toolbar"><div class="field"><input class="search-input" type="search" data-search="users" placeholder="Cari nama, NIM, atau plat nomor..." /></div><select class="search-input" style="width:auto;min-height:37px"><option>Semua status</option><option>Terdaftar</option><option>Di area</option></select><button class="button button-secondary button-small" type="button" data-action="clear-search">Atur ulang</button></div><div class="table-wrap"><table><thead><tr><th>Pengguna</th><th>Kendaraan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function reportsContent() {
    const bars = [['Sen', 42], ['Sel', 58], ['Rab', 49], ['Kam', 75], ['Jum', 66], ['Sab', 32], ['Min', 22]].map(([day, amount]) => `<div class="chart-column"><i style="height:${amount}%"></i><span>${day}</span></div>`).join('');
    const records = state.history.slice(0, 4).map((item) => `<tr><td>${dateText(item.date)}</td><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.plate)}</td><td>${escapeHtml(item.zone)}</td><td>${money(item.fee)}</td></tr>`).join('');
    return `${pageTitle('ANALISIS OPERASIONAL', 'Laporan parkir', 'Ringkasan transaksi dan penggunaan area parkir kampus.', '<button class="button button-primary" type="button" data-action="export-history">Ekspor laporan CSV</button>')}<div class="grid grid-4">${stat('Transaksi bulan ini', '1.842', 'Naik 8,4% dari bulan lalu', '↗')}${stat('Pendapatan tercatat', money(12865000), 'Akumulasi transaksi demo', 'Rp')}${stat('Rata-rata durasi', '2j 16m', 'Per kendaraan', '◷')}${stat('Pemakaian slot', '68%', 'Kapasitas rata-rata harian', '▦')}</div><div class="layout-main-aside" style="margin-top:15px"><div class="stack">${card('Aktivitas parkir minggu ini', `<div class="chart-bars">${bars}</div><div style="display:flex;justify-content:space-between;margin-top:12px"><span class="muted tiny">Transaksi per hari</span><strong class="small">Total 344 kendaraan</strong></div>`, { description: '18 - 24 November 2026' })}${card('Transaksi terbaru', `<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>No. transaksi</th><th>Plat nomor</th><th>Area</th><th>Biaya</th></tr></thead><tbody>${records || '<tr><td colspan="5">Belum ada transaksi pada demo ini.</td></tr>'}</tbody></table></div>`)}</div><div class="stack">${card('Distribusi area', `<div class="list-row"><div><div class="list-row-title">Area A · Gedung Utama</div><div class="list-row-sub">68% dari kapasitas</div></div><strong class="small">68%</strong></div><div class="progress"><i style="width:68%"></i></div><div class="list-row" style="margin-top:15px"><div><div class="list-row-title">Area B · Perpustakaan</div><div class="list-row-sub">45% dari kapasitas</div></div><strong class="small">45%</strong></div><div class="progress"><i style="width:45%;background:#47a980"></i></div>`, { description: 'Tingkat penggunaan saat ini' })}${card('Catatan laporan', '<div class="notice"><span>ⓘ</span><span>Angka pada grafik dan ringkasan merupakan data contoh untuk memperlihatkan rancangan laporan.</span></div>')}</div></div>`;
  }
  function renderStaff(route) {
    const map = {
      'staff-dashboard': staffHome,
      'verify-entry': () => verifyContent(false),
      'verify-exit': () => verifyContent(true),
      users: usersContent,
      reports: reportsContent,
      profile: profileContent,
    };
    return renderShell(route, (map[route] || staffHome)());
  }
  function renderModal() {
    if (!state.modal) return '';
    const { type } = state.modal;
    if (type === 'booking') {
      const selected = state.vehicles.find((item) => item.id === state.modal.vehicleId) || state.vehicles[0];
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Konfirmasi pemesanan</h2><p>Periksa kembali kendaraan dan lokasi pilihan Anda.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><div class="modal-body"><div class="ticket-hero"><div><div class="eyebrow">SLOT TERPILIH</div><div class="ticket-number">${escapeHtml(state.selectedSlot || 'A01')}</div><div class="muted small" style="margin-top:6px">Area A · Gedung Utama</div></div>${badge('Tersedia', 'success')}</div><div class="list-row"><div class="list-row-title">Kendaraan</div><strong class="small">${escapeHtml(selected?.plate || 'BM 1234 KS')}</strong></div><div class="list-row"><div class="list-row-title">Pemesan</div><strong class="small">${escapeHtml(state.session?.name || 'Mahasiswa')}</strong></div><div class="notice" style="margin-top:12px"><span>✓</span><span>Reservasi ini akan tersimpan sebagai tiket demo di browser.</span></div></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Batal</button><button class="button button-primary" data-action="confirm-booking">Konfirmasi reservasi</button></div></section></div>`;
    }
    if (type === 'checkout') {
      const hours = Math.max(1, Math.ceil((Date.now() - new Date(state.parking?.startedAt || Date.now()).getTime()) / 3600000));
      const fee = 3000 + Math.max(0, hours - 1) * 2000;
      state.modal.fee = fee;
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Selesaikan parkir</h2><p>Periksa ringkasan sebelum melanjutkan ke pembayaran.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><div class="modal-body"><div class="list-row"><div><div class="list-row-title">${escapeHtml(state.parking?.plate || '')}</div><div class="list-row-sub">${escapeHtml(state.parking?.zone || '')}</div></div>${badge('Parkir aktif', 'success')}</div><div class="list-row"><div class="list-row-title">Durasi tercatat</div><strong class="small">${hours} jam</strong></div><div class="list-row"><div class="list-row-title">Total tagihan demo</div><strong class="ticket-number">${money(fee)}</strong></div><p class="muted tiny" style="line-height:1.55">Tarif demo: Rp3.000 jam pertama dan Rp2.000 untuk setiap jam selanjutnya.</p></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Kembali</button><button class="button button-primary" data-action="continue-payment">Pilih pembayaran</button></div></section></div>`;
    }
    if (type === 'payment') {
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Pembayaran parkir</h2><p>Pilih metode untuk menyelesaikan transaksi demo.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><div class="modal-body"><div class="notice success" style="margin-bottom:12px"><span>✓</span><span>Total pembayaran <strong>${money(state.modal.fee)}</strong></span></div><label class="payment-option"><input type="radio" name="payment-method" value="QRIS" checked /><span><strong>QRIS</strong><small>Pindai kode pembayaran dari aplikasi bank atau dompet digital</small></span></label><label class="payment-option"><input type="radio" name="payment-method" value="Tunai di gerbang" /><span><strong>Tunai di gerbang</strong><small>Bayar langsung kepada petugas parkir</small></span></label></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Batal</button><button class="button button-primary" data-action="finish-parking">Bayar & selesaikan</button></div></section></div>`;
    }
    if (type === 'add-vehicle') {
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Tambah kendaraan</h2><p>Masukkan data kendaraan yang ingin didaftarkan.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><form data-form="add-vehicle"><div class="modal-body"><div class="field"><label for="new-plate">Nomor polisi</label><input id="new-plate" name="plate" placeholder="BM 1234 KS" required /></div><div class="grid grid-2"><div class="field"><label for="new-kind">Jenis kendaraan</label><select id="new-kind" name="kind"><option>Motor</option><option>Mobil</option></select></div><div class="field"><label for="new-color">Warna</label><input id="new-color" name="color" placeholder="Hitam" required /></div></div><div class="field"><label for="new-brand">Merek / model</label><input id="new-brand" name="brand" placeholder="Honda Vario" required /></div><label class="checkline"><input name="primary" type="checkbox" ${state.vehicles.length === 0 ? 'checked' : ''} /> Jadikan kendaraan utama</label></div><div class="modal-actions"><button class="button button-secondary" type="button" data-action="close-modal">Batal</button><button class="button button-primary" type="submit">Simpan kendaraan</button></div></form></section></div>`;
    }
    if (type === 'receipt') {
      const item = state.history.find((record) => record.id === state.modal.id);
      if (!item) return '';
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Bukti transaksi</h2><p>Ringkasan perjalanan parkir Anda.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><div class="modal-body"><div class="ticket-hero"><div><div class="eyebrow">NOMOR TRANSAKSI</div><div class="ticket-number">${escapeHtml(item.id)}</div></div>${badge(item.status, 'success')}</div><div class="list-row"><div class="list-row-title">Tanggal</div><strong class="small">${dateText(item.date)} · ${timeText(item.date)}</strong></div><div class="list-row"><div class="list-row-title">Kendaraan</div><strong class="small">${escapeHtml(item.plate)}</strong></div><div class="list-row"><div class="list-row-title">Lokasi & durasi</div><strong class="small">${escapeHtml(item.zone)} · ${escapeHtml(item.duration)}</strong></div><div class="list-row"><div class="list-row-title">Total dibayar</div><strong>${money(item.fee)}</strong></div></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Tutup</button><button class="button button-primary" data-action="print-ticket">Cetak</button></div></section></div>`;
    }
    if (type === 'user-detail') {
      const vehicle = state.vehicles.find((item) => item.plate === state.modal.id);
      return `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Detail kendaraan</h2><p>Informasi kendaraan pada data demo.</p></div><button class="icon-button" aria-label="Tutup" data-action="close-modal">×</button></div><div class="modal-body"><div class="ticket-hero"><div><div class="eyebrow">NOMOR POLISI</div><div class="ticket-number">${escapeHtml(vehicle?.plate || state.modal.id)}</div></div>${badge(state.parking?.plate === state.modal.id ? 'Di area' : 'Terdaftar', state.parking?.plate === state.modal.id ? 'warning' : 'success')}</div><div class="list-row"><div class="list-row-title">Merek kendaraan</div><strong class="small">${escapeHtml(vehicle?.brand || 'Data demo')}</strong></div><div class="list-row"><div class="list-row-title">Jenis</div><strong class="small">${escapeHtml(vehicle?.kind || 'Motor')}</strong></div></div><div class="modal-actions"><button class="button button-primary" data-action="close-modal">Selesai</button></div></section></div>`;
    }
    return '';
  }
  function render() {
    let route = currentRoute();
    if (state.session && ['login', 'register', 'forgot'].includes(route)) {
      route = state.session.role === 'staff' ? 'staff-dashboard' : 'dashboard';
      if (currentRoute() !== route) location.hash = `#/${route}`;
    }
    if (!state.session) {
      app.innerHTML = renderAuth(['register', 'forgot'].includes(route) ? route : 'login');
      return;
    }
    if (state.session.role === 'staff') app.innerHTML = renderStaff(route);
    else app.innerHTML = renderStudent(route);
  }
  function setSession(role, formData) {
    const identity = formData.get('identity') || (role === 'staff' ? 'petugas@kampus.ac.id' : '230411015');
    const email = String(identity).includes('@') ? String(identity) : (role === 'staff' ? 'petugas@kampus.ac.id' : 'nadia@kampus.ac.id');
    state.session = {
      role,
      name: role === 'staff' ? 'Dimas Pratama' : 'Nadia Putri',
      identity: String(identity),
      email,
      phone: '081234567890',
    };
    if (role === 'staff') {
      state.session.name = 'Dimas Pratama';
      state.session.identity = String(identity);
    } else if (state.pendingAccount) {
      state.session = { ...state.pendingAccount, role: 'student' };
      state.pendingAccount = null;
    }
    saveState();
    location.hash = role === 'staff' ? '#/staff-dashboard' : '#/dashboard';
    render();
    toast(`Selamat datang, ${state.session.name}.`);
  }
  function confirmBooking() {
    const vehicle = state.vehicles.find((item) => item.id === state.modal.vehicleId) || state.vehicles[0];
    if (!vehicle) { state.modal = null; render(); toast('Tambahkan kendaraan sebelum memesan slot.', 'error'); return; }
    state.parking = {
      code: `LT-${String(now().getFullYear()).slice(-2)}${String(now().getMonth() + 1).padStart(2, '0')}${String(now().getDate()).padStart(2, '0')}-${String(Math.floor(10 + Math.random() * 89))}`,
      plate: vehicle.plate,
      kind: vehicle.kind,
      vehicle: vehicle.brand,
      zone: `Area A · ${state.selectedSlot || 'A01'}`,
      status: 'Menunggu masuk',
      startedAt: now().toISOString(),
      fee: 3000,
    };
    saveState();
    state.modal = null;
    location.hash = '#/ticket';
    render();
    toast('Slot berhasil dipesan. QR tiket Anda sudah siap.');
  }
  function finishParking() {
    if (!state.parking) return;
    const hours = Math.max(1, Math.ceil((Date.now() - new Date(state.parking.startedAt).getTime()) / 3600000));
    const fee = Number(state.modal?.fee || (3000 + Math.max(0, hours - 1) * 2000));
    const payment = document.querySelector('input[name="payment-method"]:checked')?.value || 'QRIS';
    state.history.unshift({
      id: `TRX-${String(now().getFullYear()).slice(-2)}${String(now().getMonth() + 1).padStart(2, '0')}${String(now().getDate()).padStart(2, '0')}-${String(Math.floor(100 + Math.random() * 899))}`,
      date: now().toISOString(), plate: state.parking.plate, zone: state.parking.zone, duration: `${hours} jam`, fee, status: 'Selesai', payment,
    });
    state.parking = null;
    state.modal = null;
    saveState();
    location.hash = state.session?.role === 'staff' ? '#/staff-dashboard' : '#/history';
    render();
    toast('Pembayaran berhasil. Perjalanan parkir selesai.');
  }
  function downloadCsv(filename, rows) {
    const content = rows.map((row) => row.map((item) => `"${String(item ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    toast('File CSV berhasil disiapkan untuk diunduh.');
  }
  function handleClick(event) {
    const roleButton = event.target.closest('[data-role]');
    if (roleButton) { state.role = roleButton.dataset.role; render(); return; }
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) { event.preventDefault(); go(routeButton.dataset.route); return; }
    const slotButton = event.target.closest('[data-slot]');
    if (slotButton && !slotButton.disabled) {
      state.selectedSlot = slotButton.dataset.slot;
      const slotInput = document.querySelector('input[name="slot"]'); if (slotInput) slotInput.value = state.selectedSlot;
      app.querySelectorAll('.slot.selected').forEach((el) => el.classList.remove('selected'));
      slotButton.classList.add('selected');
      const hidden = app.querySelector('input[name="slot"]'); if (hidden) hidden.value = state.selectedSlot;
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      if (event.target.matches('[data-backdrop]')) { state.modal = null; render(); }
      return;
    }
    const { action, id } = actionButton.dataset;
    if (action === 'logout') { state.session = null; state.modal = null; saveState(); location.hash = '#/login'; render(); toast('Anda sudah keluar dari akun.'); }
    else if (action === 'demo-fill') {
      const identity = document.getElementById('identity'); const password = document.getElementById('password');
      if (identity) identity.value = state.role === 'staff' ? 'petugas@kampus.ac.id' : '230411015';
      if (password) password.value = 'lentera123';
      toast('Akun demo siap. Tekan tombol Masuk.');
    }
    else if (action === 'toggle-password') {
      const input = actionButton.parentElement.querySelector('input');
      if (input) { input.type = input.type === 'password' ? 'text' : 'password'; actionButton.textContent = input.type === 'password' ? 'Lihat' : 'Sembunyikan'; }
    }
    else if (action === 'add-vehicle') showModal('add-vehicle');
    else if (action === 'close-modal') { state.modal = null; render(); }
    else if (action === 'confirm-booking') confirmBooking();
    else if (action === 'checkout') showModal('checkout');
    else if (action === 'continue-payment') { const fee = state.modal?.fee; state.modal = { type: 'payment', fee }; render(); }
    else if (action === 'finish-parking') finishParking();
    else if (action === 'receipt') showModal('receipt', { id });
    else if (action === 'set-primary') {
      state.vehicles = state.vehicles.map((vehicle) => ({ ...vehicle, primary: vehicle.id === id })); saveState(); render(); toast('Kendaraan utama berhasil diperbarui.');
    }
    else if (action === 'delete-vehicle') {
      const vehicle = state.vehicles.find((item) => item.id === id);
      if (vehicle && state.parking?.plate === vehicle.plate) { toast('Kendaraan dengan parkir aktif tidak dapat dihapus.', 'error'); return; }
      state.vehicles = state.vehicles.filter((item) => item.id !== id);
      if (state.vehicles.length && !state.vehicles.some((item) => item.primary)) state.vehicles[0].primary = true;
      saveState(); render(); toast('Kendaraan dihapus dari daftar.');
    }
    else if (action === 'export-history') {
      const rows = [['No. transaksi', 'Tanggal', 'Plat nomor', 'Area', 'Durasi', 'Biaya', 'Status'], ...state.history.map((item) => [item.id, dateText(item.date), item.plate, item.zone, item.duration, item.fee, item.status])];
      downloadCsv('riwayat-parkir-lentera.csv', rows);
    }
    else if (action === 'export-users') {
      const rows = [['Nama pengguna', 'Plat nomor', 'Jenis', 'Merek', 'Status'], ...state.vehicles.map((vehicle) => [state.session?.name || 'Pengguna', vehicle.plate, vehicle.kind, vehicle.brand, state.parking?.plate === vehicle.plate ? 'Di area' : 'Terdaftar'])];
      downloadCsv('data-kendaraan-lentera.csv', rows);
    }
    else if (action === 'sample-code') {
      const input = document.getElementById('ticket-code');
      if (input) input.value = state.parking?.code || state.vehicles[0]?.plate || 'BM 1234 KS';
      toast('Contoh tiket sudah dimasukkan.');
    }
    else if (action === 'clear-search') { const search = document.querySelector('[data-search="users"]'); if (search) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); } }
    else if (action === 'user-detail') showModal('user-detail', { id });
    else if (action === 'print-ticket') window.print();
  }
  function handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const kind = form.dataset.form;
    if (kind === 'login') { setSession(state.role, data); }
    else if (kind === 'register') {
      state.pendingAccount = {
        name: String(data.get('fullName')).trim(), identity: String(data.get('studentId')).trim(), email: String(data.get('email')).trim(), phone: String(data.get('phone')).trim(),
      };
      const plate = String(data.get('plate')).trim().toUpperCase();
      if (plate) {
        state.vehicles = [{ id: `v-${Date.now()}`, plate, kind: 'Motor', brand: 'Kendaraan saya', color: 'Belum diisi', primary: true }, ...state.vehicles.filter((item) => !item.primary)];
        write(KEYS.vehicles, state.vehicles);
      }
      location.hash = '#/login'; state.role = 'student'; render(); toast('Pendaftaran demo berhasil. Silakan masuk untuk melanjutkan.');
    }
    else if (kind === 'forgot') {
      const message = document.getElementById('auth-message');
      if (message) { message.textContent = 'Instruksi reset demo sudah disiapkan. Periksa email kampus Anda.'; message.className = 'inline-message success show'; }
      form.reset();
    }
    else if (kind === 'find-parking') {
      if (state.parking?.status === 'Parkir aktif') { toast('Selesaikan parkir aktif sebelum memesan slot lain.', 'error'); return; }
      if (!state.vehicles.length) { toast('Tambahkan kendaraan terlebih dahulu.', 'error'); return; }
      const vehicleId = String(data.get('vehicle'));
      if (!state.selectedSlot) { toast('Pilih slot berwarna hijau pada peta terlebih dahulu.', 'error'); return; }
      state.modal = { type: 'booking', vehicleId };
      render();
    }
    else if (kind === 'add-vehicle') {
      const primary = data.get('primary') === 'on' || state.vehicles.length === 0;
      const vehicle = { id: `v-${Date.now()}`, plate: String(data.get('plate')).trim().toUpperCase(), kind: String(data.get('kind')), color: String(data.get('color')).trim(), brand: String(data.get('brand')).trim(), primary };
      state.vehicles = [...state.vehicles.map((item) => ({ ...item, primary: primary ? false : item.primary })), vehicle];
      if (!state.vehicles.some((item) => item.primary)) state.vehicles[0].primary = true;
      state.modal = null; saveState(); render(); toast('Kendaraan berhasil ditambahkan.');
    }
    else if (kind === 'verify') {
      const input = String(data.get('code')).trim().toUpperCase();
      const foundParking = state.parking && (state.parking.code.toUpperCase() === input || state.parking.plate.toUpperCase() === input);
      const foundVehicle = state.vehicles.find((vehicle) => vehicle.plate.toUpperCase() === input);
      if (foundParking) {
        const wasActive = state.parking.status === 'Parkir aktif';
        if (data.get('action') === 'keluar') {
          state.verification = { found: true, message: `${state.parking.plate} cocok dengan tiket ${state.parking.code}. Lanjutkan ke proses keluar dan pembayaran.` };
          state.modal = { type: 'checkout' };
          render();
        } else {
          state.parking.status = 'Parkir aktif'; state.parking.startedAt = wasActive ? state.parking.startedAt : now().toISOString(); saveState(); state.verification = { found: true, message: `Tiket ${state.parking.code} valid untuk ${state.parking.plate}. Kendaraan tercatat masuk.` }; render(); toast('Kendaraan berhasil diverifikasi masuk.');
        }
      } else if (foundVehicle) {
        state.verification = { found: false, message: `${foundVehicle.plate} terdaftar, tetapi tiket parkir aktif tidak ditemukan. Minta pengguna menunjukkan QR reservasi.` };
        render();
      } else {
        state.verification = { found: false, message: 'Kode tiket atau nomor polisi tidak ditemukan. Periksa kembali data yang dimasukkan.' };
        render();
      }
    }
    else if (kind === 'profile') {
      state.session = { ...state.session, name: String(data.get('name')).trim(), email: String(data.get('email')).trim(), identity: String(data.get('identity')).trim(), phone: String(data.get('phone')).trim() };
      saveState(); render(); toast('Informasi profil berhasil disimpan.');
    }
  }
  function handleInput(event) {
    if (event.target.matches('[data-search="users"]')) {
      const query = event.target.value.toLowerCase();
      app.querySelectorAll('tbody tr').forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
    }
  }
  function handleChange(event) {
    if (event.target.matches('[data-filter="history"]')) {
      const selected = event.target.value;
      app.querySelectorAll('tbody tr').forEach((row) => { row.hidden = selected !== 'Semua' && !row.textContent.includes(selected); });
    }
  }
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.modal) { state.modal = null; render(); } });
  window.addEventListener('hashchange', render);
  updateRouteOnLoad();
  render();
})();
