import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- Configuration ---
// Fetch environment configuration dynamically from the backend so nothing is hardcoded
const API_BASE = '/api';
const configRes = await fetch(`${API_BASE}/config`);
const config = await configRes.json();

const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let lastData = []; // Global store for re-rendering on theme change

// --- Utilities ---
const toCurrency = (value) => new Intl.NumberFormat('en-PK', {
  style: 'currency', currency: 'PKR',
}).format(value);

const getToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
};

const buildStatus = (el, message, isError) => {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${isError ? 'text-red-400' : 'text-emerald-400'} text-xs mt-2`;
};

// --- Theme & Interaction Engine ---
const initTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const toggleBtns = document.querySelectorAll('#themeToggle, .theme-switch, #themeToggleGlobal');

  if (toggleBtns.length > 0) {
    const setIcon = (theme) => {
      const icon = theme === 'dark' ? '☀️' : '🌙';
      toggleBtns.forEach(btn => {
        if (btn instanceof HTMLElement) {
          btn.textContent = icon;
          btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
      });
    };

    setIcon(savedTheme);

    const doToggle = () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = (current === 'dark') ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      setIcon(next);

      if (window.eidiChart && lastData.length > 0) {
        const ctx = document.getElementById('breakdownChart')?.getContext('2d');
        if (ctx) renderChart(lastData, ctx);
      }
    };

    toggleBtns.forEach(btn => {
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', doToggle);
    });
  }
};

const initGlow = () => {
  document.addEventListener('mousemove', (e) => {
    // Background movement
    const bx = (e.clientX / window.innerWidth) * 100;
    const by = (e.clientY / window.innerHeight) * 100;
    document.body.style.backgroundPosition = `${bx}% ${by}%`;

    // Card spotlight effect
    document.querySelectorAll('.glass-card').forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
};

// --- Rendering Engine ---
const renderChart = (rows, ctx) => {
  if (!ctx) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const received = rows.filter(x => x.type === 'received').reduce((s, x) => s + x.amount, 0);
  const sent = rows.filter(x => x.type === 'sent').reduce((s, x) => s + x.amount, 0);

  if (window.eidiChart) window.eidiChart.destroy();

  window.eidiChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Received', 'Sent'],
      datasets: [{
        data: [received, sent],
        backgroundColor: [isDark ? '#8b5cf6' : '#4f46e5', isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'],
        borderColor: [isDark ? 'rgba(139, 92, 246, 0.5)' : '#4f46e5', 'transparent'],
        borderWidth: 1,
        hoverOffset: 15
      }],
    },
    options: {
      cutout: '85%',
      plugins: { legend: { display: false } },
      animation: { animateScale: true }
    },
  });
};

const renderStats = (rows, container) => {
  if (!container) return;
  const received = rows.filter(x => x.type === 'received').reduce((s, x) => s + x.amount, 0);
  const sent = rows.filter(x => x.type === 'sent').reduce((s, x) => s + x.amount, 0);

  container.innerHTML = `
    <div class="glass-card p-6 flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Received</h3>
      <p class="text-[2rem] font-extrabold text-[var(--text-main)]">${toCurrency(received)}</p>
    </div>
    <div class="glass-card p-6 flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Sent</h3>
      <p class="text-[2rem] font-extrabold text-[var(--text-main)]">${toCurrency(sent)}</p>
    </div>
    <div class="glass-card p-6 flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Balance</h3>
      <p class="text-[2rem] font-extrabold ${received - sent >= 0 ? 'text-emerald-400' : 'text-red-400'}">
        ${toCurrency(received - sent)}
      </p>
    </div>
  `;
};

// --- Data Fetching ---
const loadDashboard = async () => {
  const token = await getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const [entriesRes, aiRes] = await Promise.all([
      fetch(`${API_BASE}/eidis`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/ai-comment`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const entriesPayload = await entriesRes.json();
    lastData = entriesPayload.data || []; // Update global store

    renderStats(lastData, document.getElementById('summaryCards'));
    renderChart(lastData, document.getElementById('breakdownChart')?.getContext('2d'));

    const aiComment = document.getElementById('aiComment');
    if (aiComment) {
      const aiPayload = await aiRes.json().catch(() => ({ comment: 'AI insight currently unavailable.' }));
      aiComment.textContent = aiPayload.comment;
    }

    // History table
    const tbody = document.querySelector('#logTable tbody');
    if (tbody) {
      tbody.innerHTML = lastData.map(item => `
        <tr class="group">
          <td>
             <div class="w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-lg ${item.type === 'received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}">
                <span class="pb-0.5">${item.type === 'received' ? '↓' : '↑'}</span>
             </div>
          </td>
          <td class="font-extrabold text-[var(--text-main)] text-lg">${toCurrency(item.amount)}</td>
          <td class="text-[var(--text-main)] font-semibold">${item.sender_name}</td>
          <td class="text-[var(--text-muted)] text-sm">${item.notes || '-'}</td>
          <td class="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">${new Date(item.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error("Dashboard Load Error:", err);
  }
};

// --- Initialization ---
const initApp = async () => {
  initTheme();
  initGlow();

  if (window.location.pathname.includes('dashboard.html')) {
    loadDashboard();

    // Log Form Handler
    document.getElementById('logForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = await getToken();
      const status = document.getElementById('logStatus');

      const body = {
        type: document.getElementById('entryType').value,
        amount: Number(document.getElementById('amount').value),
        sender_name: document.getElementById('name').value,
        notes: document.getElementById('notes').value
      };

      const res = await fetch(`${API_BASE}/eidis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        buildStatus(status, 'Logged successfully', false);
        e.target.reset();
        loadDashboard();
      } else {
        buildStatus(status, 'Error logging data', true);
      }
    });

    document.getElementById('signOut')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
    const form = document.getElementById('loginForm');
    const status = document.getElementById('status');

    // If already signed in, redirect
    const token = await getToken();
    if (token) {
      window.location.href = 'dashboard.html';
      return;
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value?.trim();
      if (!email) {
        buildStatus(status, 'Please enter a valid email.', true);
        return;
      }

      buildStatus(status, 'Sending magic link...', false);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + '/dashboard.html' }
      });

      if (error) {
        buildStatus(status, `Error: ${error.message}`, true);
      } else {
        buildStatus(status, 'Magic link sent! Please check your email inbox to log in. You will be redirected after clicking the link.', false);
      }
    });
  }
};

// Execute init immediately (since type="module" defers execution naturally)
initApp();