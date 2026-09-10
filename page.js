'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const CAT_COLORS = ["#5B8AA6","#C1666B","#6E9B7B","#B98CC4","#D9A441","#7C9CBF","#A6785B","#84A98C"];
const FAKE_DOMAIN = '@papankuliah.appuser.com';
const DAY_MS = 86400000;
const DEFAULT_CATS = [
  { name: "Tugas", color: CAT_COLORS[0] },
  { name: "Ujian", color: CAT_COLORS[1] },
  { name: "Proyek", color: CAT_COLORS[2] },
  { name: "Organisasi", color: CAT_COLORS[3] },
];

function sanitizeUsername(raw) {
  return (raw || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}
function usernameToEmail(username) {
  return username + FAKE_DOMAIN;
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / DAY_MS);
}
function dateBadgeText(dateStr) {
  const n = daysUntil(dateStr);
  if (n === null) return '';
  if (n < 0) return 'Terlambat ' + Math.abs(n) + ' hr';
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  return n + ' hari lagi';
}
function fmtDateID(d) {
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}
function groupOf(t) {
  if (t.done) return 'done';
  if (!t.deadline) return 'nodate';
  const n = daysUntil(t.deadline);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'week';
  return 'later';
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}
const TILTS = [-1.4,-0.6,0.5,1.2,-1.0,0.8];
const GROUP_DEFS = [
  { key: 'overdue', label: 'Terlambat', cls: 'overdue' },
  { key: 'today', label: 'Hari Ini', cls: 'today' },
  { key: 'week', label: 'Minggu Ini', cls: '' },
  { key: 'later', label: 'Nanti', cls: '' },
  { key: 'nodate', label: 'Tanpa Tenggat', cls: '' },
];

export default function Home() {
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [authReady, setAuthReady] = useState(false);

  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [liUsername, setLiUsername] = useState('');
  const [liPassword, setLiPassword] = useState('');
  const [rgName, setRgName] = useState('');
  const [rgUsername, setRgUsername] = useState('');
  const [rgPassword, setRgPassword] = useState('');
  const [rgPassword2, setRgPassword2] = useState('');

  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filterCat, setFilterCat] = useState(null);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [quickTitle, setQuickTitle] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', catId: '', priority: 'sedang', deadline: '', note: '' });

  const [toast, setToast] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setDisplayName(data.session?.user?.user_metadata?.display_name || '');
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setDisplayName(sess?.user?.user_metadata?.display_name || '');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async (uid) => {
    let { data: cats } = await supabase.from('categories').select('*').eq('user_id', uid).order('created_at');
    if (!cats || cats.length === 0) {
      const seed = DEFAULT_CATS.map(c => ({ ...c, user_id: uid }));
      const { data: inserted } = await supabase.from('categories').insert(seed).select();
      cats = inserted || [];
    }
    setCategories(cats);
    const { data: t } = await supabase.from('tasks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    setTasks(t || []);
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadData(session.user.id);
  }, [session, loadData]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    const username = sanitizeUsername(liUsername);
    if (!username || !liPassword) { setAuthError('Isi username dan password.'); return; }
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: liPassword });
    setAuthBusy(false);
    if (error) setAuthError('Username atau password salah.');
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthError('');
    const username = sanitizeUsername(rgUsername);
    if (!rgName.trim()) { setAuthError('Isi nama tampilan dulu.'); return; }
    if (!username) { setAuthError('Username harus berisi huruf/angka, tanpa spasi.'); return; }
    if (rgPassword.length < 6) { setAuthError('Password minimal 6 karakter.'); return; }
    if (rgPassword !== rgPassword2) { setAuthError('Konfirmasi password tidak cocok.'); return; }
    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: rgPassword,
      options: { data: { display_name: rgName.trim(), username } },
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message.includes('already') ? 'Username sudah dipakai, coba yang lain.' : error.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setCategories([]); setTasks([]);
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name || !session) return;
    const color = CAT_COLORS[categories.length % CAT_COLORS.length];
    const { data } = await supabase.from('categories').insert({ user_id: session.user.id, name, color }).select();
    if (data) setCategories(prev => [...prev, data[0]]);
    setNewCatName('');
  }

  async function deleteCategory(catId) {
    if (categories.length <= 1) { showToast('Minimal harus ada satu mata kuliah.'); return; }
    const fallback = categories.find(c => c.id !== catId);
    await supabase.from('tasks').update({ cat_id: fallback.id }).eq('cat_id', catId).eq('user_id', session.user.id);
    await supabase.from('categories').delete().eq('id', catId).eq('user_id', session.user.id);
    setTasks(prev => prev.map(t => t.cat_id === catId ? { ...t, cat_id: fallback.id } : t));
    setCategories(prev => prev.filter(c => c.id !== catId));
    if (filterCat === catId) setFilterCat(null);
  }

  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title || !session) return;
    const catId = categories[0]?.id || null;
    const { data } = await supabase.from('tasks').insert({
      user_id: session.user.id, title, note: '', cat_id: catId, deadline: null, priority: 'sedang', done: false,
    }).select();
    if (data) setTasks(prev => [data[0], ...prev]);
    setQuickTitle('');
  }

  async function toggleDone(t) {
    const done = !t.done;
    const completed_on = done ? todayStr() : null;
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done, completed_on } : x));
    await supabase.from('tasks').update({ done, completed_on }).eq('id', t.id).eq('user_id', session.user.id);
  }

  function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    const timer = setTimeout(async () => {
      await supabase.from('tasks').delete().eq('id', id).eq('user_id', session.user.id);
      setPendingDelete(null);
    }, 4200);
    setPendingDelete({ task, timer });
    showToast('Tugas dihapus.');
  }

  function undoDelete() {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      setTasks(prev => [pendingDelete.task, ...prev]);
      setPendingDelete(null);
    }
    setToast(null);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(cur => cur === msg ? null : cur), 4200);
  }

  function openModal(id) {
    if (id) {
      const t = tasks.find(x => x.id === id);
      setForm({ title: t.title, catId: t.cat_id || '', priority: t.priority, deadline: t.deadline || '', note: t.note || '' });
      setEditId(id);
    } else {
      setForm({ title: quickTitle.trim(), catId: categories[0]?.id || '', priority: 'sedang', deadline: '', note: '' });
      setEditId(null);
    }
    setModalOpen(true);
  }

  async function saveModal() {
    const title = form.title.trim();
    if (!title || !session) return;
    if (editId) {
      const patch = { title, cat_id: form.catId || null, priority: form.priority, deadline: form.deadline || null, note: form.note.trim() };
      setTasks(prev => prev.map(t => t.id === editId ? { ...t, ...patch } : t));
      await supabase.from('tasks').update(patch).eq('id', editId).eq('user_id', session.user.id);
    } else {
      const row = { user_id: session.user.id, title, cat_id: form.catId || null, priority: form.priority, deadline: form.deadline || null, note: form.note.trim(), done: false };
      const { data } = await supabase.from('tasks').insert(row).select();
      if (data) setTasks(prev => [data[0], ...prev]);
      setQuickTitle('');
    }
    setModalOpen(false);
  }

  function deleteFromModal() {
    if (editId) { const id = editId; setModalOpen(false); deleteTask(id); }
  }

  const catById = (id) => categories.find(c => c.id === id);
  const visible = tasks.filter(t => filterCat === null || t.cat_id === filterCat);
  const today = todayStr();
  const todays = tasks.filter(t => !t.done && t.deadline === today);
  const overdue = tasks.filter(t => !t.done && t.deadline && daysUntil(t.deadline) < 0);
  const doneToday = tasks.filter(t => t.done && t.completed_on === today);
  const totalToday = todays.length + doneToday.length;
  const pct = totalToday ? doneToday.length / totalToday : 0;
  const circumference = 119.4;

  if (!authReady) return null;

  if (!session) {
    return (
      <div id="authScreen">
        <div className="id-card">
          <h1>Papan Kuliah</h1>
          <p className="sub">Masuk atau daftar untuk mulai mencatat tugas kuliahmu</p>
          <div className="auth-tabs">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthError(''); }}>Masuk</button>
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setAuthError(''); }}>Daftar</button>
          </div>
          {authError && <div className="auth-error">{authError}</div>}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="auth-field">
                <label>Username</label>
                <input type="text" value={liUsername} onChange={e => setLiUsername(e.target.value)} placeholder="username kamu" />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" value={liPassword} onChange={e => setLiPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" className="auth-submit" disabled={authBusy}>{authBusy ? 'Memproses…' : 'Masuk'}</button>
              <p className="auth-hint">Belum punya akun? Klik tab &quot;Daftar&quot; di atas.</p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="auth-field">
                <label>Nama tampilan</label>
                <input type="text" value={rgName} onChange={e => setRgName(e.target.value)} placeholder="mis. Salsabila" maxLength={40} />
              </div>
              <div className="auth-field">
                <label>Username</label>
                <input type="text" value={rgUsername} onChange={e => setRgUsername(e.target.value)} placeholder="huruf/angka, tanpa spasi" maxLength={30} />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" value={rgPassword} onChange={e => setRgPassword(e.target.value)} placeholder="minimal 6 karakter" />
              </div>
              <div className="auth-field">
                <label>Ulangi Password</label>
                <input type="password" value={rgPassword2} onChange={e => setRgPassword2(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" className="auth-submit" disabled={authBusy}>{authBusy ? 'Memproses…' : 'Daftar & Masuk'}</button>
              <p className="auth-hint">Data akun tersimpan aman di database sungguhan (Supabase).</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  const byGroup = {};
  GROUP_DEFS.forEach(g => byGroup[g.key] = []);
  const doneList = [];
  visible.forEach(t => {
    const g = groupOf(t);
    if (g === 'done') doneList.push(t); else byGroup[g].push(t);
  });
  const sortFn = (a, b) => {
    const da = a.deadline ? new Date(a.deadline) : new Date(8640000000000000);
    const db = b.deadline ? new Date(b.deadline) : new Date(8640000000000000);
    if (da - db !== 0) return da - db;
    const pr = { tinggi: 0, sedang: 1, rendah: 2 };
    return pr[a.priority] - pr[b.priority];
  };
  doneList.sort((a, b) => (b.completed_on || '').localeCompare(a.completed_on || ''));

  function TaskCard({ t }) {
    const cat = catById(t.cat_id);
    const color = cat ? cat.color : '#8A8368';
    const n = t.deadline ? daysUntil(t.deadline) : null;
    const dateCls = n === null ? '' : (n < 0 ? 'overdue' : n === 0 ? 'today' : '');
    const tilt = TILTS[Math.abs(hashCode(t.id)) % TILTS.length];
    return (
      <article className={'task-card' + (t.done ? ' done' : '')} style={{ '--tilt': tilt + 'deg', '--tape': color, transform: `rotate(${tilt}deg)` }}>
        <button className="chk" onClick={() => toggleDone(t)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="4,13 9,18 20,6" /></svg>
        </button>
        <div className="t-body">
          <p className="t-title">{t.priority === 'tinggi' ? '📌 ' : ''}{t.title}</p>
          {t.note && <p className="t-note">{t.note}</p>}
          <div className="t-meta">
            {cat && <span className="meta-pill meta-cat" style={{ background: color }}>{cat.name}</span>}
            {t.deadline && <span className={'meta-pill meta-date ' + dateCls}>{dateBadgeText(t.deadline)}</span>}
          </div>
        </div>
        <div className="t-actions">
          <button onClick={() => openModal(t.id)} title="Edit">✎</button>
          <button onClick={() => deleteTask(t.id)} title="Hapus">🗑</button>
        </div>
      </article>
    );
  }

  return (
    <div id="app">
      <header className="top">
        <div className="brand">
          <h1>Papan Kuliah</h1>
          <p>Halo, {displayName}! Ini semua tugas kuliahmu.</p>
          <div className="date-line">{fmtDateID(new Date())}</div>
        </div>
        <div className="header-right">
          <div className="stat-strip">
            <div className="stat-chip"><div className="num">{todays.length}</div><div className="lbl">Jatuh tempo hari ini</div></div>
            <div className={'stat-chip' + (overdue.length ? ' warn' : '')}><div className="num">{overdue.length}</div><div className="lbl">Terlambat</div></div>
            <div className="stat-chip good"><div className="num">{doneToday.length}</div><div className="lbl">Selesai hari ini</div></div>
          </div>
          <div className="account-row">
            <span>Masuk sebagai <b>{displayName}</b></span>
            <button className="logout-btn" onClick={handleLogout}>Keluar</button>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2>Mata Kuliah</h2>
          <ul className="cat-list">
            <li className={'cat-item' + (filterCat === null ? ' active' : '')} onClick={() => setFilterCat(null)}>
              <span className="cat-dot" style={{ background: 'linear-gradient(135deg,#5B8AA6,#C1666B)' }} />
              Semua
              <span className="cnt">{tasks.filter(t => !t.done).length}</span>
            </li>
            {categories.map(c => (
              <li key={c.id} className={'cat-item' + (filterCat === c.id ? ' active' : '')} onClick={() => setFilterCat(c.id)}>
                <span className="cat-dot" style={{ background: c.color }} />
                {c.name}
                <span className="cnt">{tasks.filter(t => t.cat_id === c.id && !t.done).length}</span>
                <button className="del-cat" onClick={(e) => { e.stopPropagation(); deleteCategory(c.id); }} title="Hapus">×</button>
              </li>
            ))}
          </ul>
          <div className="add-cat">
            <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="Tambah mata kuliah…" maxLength={24} />
            <button onClick={addCategory}>+</button>
          </div>
          <div className="progress-block">
            <h2>Hari Ini</h2>
            <div className="ring-row">
              <svg width="46" height="46" viewBox="0 0 46 46">
                <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle cx="23" cy="23" r="19" fill="none" stroke="#F2B84B" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} transform="rotate(-90 23 23)" />
              </svg>
              <div className="ring-text">
                {totalToday ? <><b>{doneToday.length}/{totalToday}</b> tugas hari ini selesai</> : 'Tidak ada tenggat hari ini. Santai dulu ☕'}
              </div>
            </div>
          </div>
        </aside>

        <main>
          <div className="quick-add">
            <input type="text" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && quickAdd()} placeholder="Tulis tugas baru, lalu tekan Enter…" maxLength={140} />
            <button className="primary" onClick={quickAdd}>Tambah</button>
            <button className="ghost" onClick={() => openModal(null)}>+ Detail</button>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <div className="es-title">Papan masih kosong</div>
              <div>Yuk catat tugas kuliah pertamamu — ketik di atas atau tekan tombol +.</div>
            </div>
          ) : (
            <>
              {GROUP_DEFS.map(g => {
                const list = byGroup[g.key];
                if (!list.length) return null;
                list.sort(sortFn);
                return (
                  <section className="group" key={g.key}>
                    <div className={'group-head ' + g.cls}><h3>{g.label}</h3><span className="g-count">{list.length}</span></div>
                    <div className="card-grid">{list.map(t => <TaskCard t={t} key={t.id} />)}</div>
                  </section>
                );
              })}
              {doneList.length > 0 && (
                <section className="group done-group">
                  <div className="group-head" onClick={() => setDoneCollapsed(v => !v)}>
                    <h3>Selesai</h3><span className="g-count">{doneList.length}</span>
                    <span className={'toggle-caret' + (doneCollapsed ? ' collapsed' : '')}>▾</span>
                  </div>
                  {!doneCollapsed && <div className="card-grid">{doneList.map(t => <TaskCard t={t} key={t.id} />)}</div>}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <button className="fab" onClick={() => openModal(null)} title="Tambah tugas">+</button>

      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editId ? 'Ubah Tugas' : 'Tugas Baru'}</h3>
            <div className="field">
              <label>Judul tugas</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="mis. Kerjakan modul praktikum Basis Data" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Mata kuliah</label>
                <select value={form.catId} onChange={e => setForm({ ...form, catId: e.target.value })}>
                  {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Prioritas</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="tinggi">Tinggi</option>
                  <option value="sedang">Sedang</option>
                  <option value="rendah">Rendah</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Tenggat (opsional)</label>
              <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="field">
              <label>Catatan (opsional)</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={300} placeholder="Detail tambahan…" />
            </div>
            <div className="modal-actions">
              <button className="danger-link" style={{ visibility: editId ? 'visible' : 'hidden' }} onClick={deleteFromModal}>Hapus tugas ini</button>
              <div className="modal-btns">
                <button className="cancel" onClick={() => setModalOpen(false)}>Batal</button>
                <button className="save" onClick={saveModal}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>{toast}</span>
          {pendingDelete && <button onClick={undoDelete}>Urungkan</button>}
        </div>
      )}
    </div>
  );
}
