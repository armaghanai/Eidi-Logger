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

  const container = ctx.canvas.parentElement;
  if (received === 0 && sent === 0) {
    if (window.eidiChart) window.eidiChart.destroy();
    ctx.canvas.style.display = 'none';
    let emptyMsg = container.querySelector('.chart-empty');
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'chart-empty absolute inset-0 flex items-center justify-center text-center text-sm font-bold text-[var(--primary)] opacity-60 p-4';
      emptyMsg.innerHTML = 'Add your first transaction<br/>to display visual chart.';
      container.appendChild(emptyMsg);
    }
    return;
  }

  ctx.canvas.style.display = 'block';
  const emptyMsg = container.querySelector('.chart-empty');
  if (emptyMsg) emptyMsg.remove();

  if (window.eidiChart) window.eidiChart.destroy();

  window.eidiChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Received', 'Sent'],
      datasets: [{
        data: [received, sent],
        backgroundColor: ['#10b981', '#f43f5e'],
        borderColor: [isDark ? '#020617' : '#ffffff', isDark ? '#020617' : '#ffffff'],
        borderWidth: 4,
        borderRadius: 4,
        hoverOffset: 20
      }],
    },
    options: {
      cutout: '75%',
      layout: { padding: 10 },
      plugins: { 
        legend: { 
          display: true, 
          position: 'bottom',
          labels: { color: isDark ? '#f8fafc' : '#0f172a', font: { family: 'Outfit', size: 13, weight: 'bold' }, padding: 20, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#94a3b8' : '#64748b',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function(context) { return ' PKR ' + context.parsed.toLocaleString(); }
          }
        }
      },
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
    const entriesRes = await fetch(`${API_BASE}/eidis`, { headers: { Authorization: `Bearer ${token}` } });
    const entriesPayload = await entriesRes.json();
    lastData = entriesPayload.data || []; // Update global store

    renderStats(lastData, document.getElementById('summaryCards'));
    renderChart(lastData, document.getElementById('breakdownChart')?.getContext('2d'));

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
          <td class="text-right">
             <button class="delete-btn text-[var(--text-muted)] hover:text-red-500 transition-colors p-2 rounded hover:bg-red-500/10" data-id="${item.id}" aria-label="Delete transaction">
                <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!confirm('Are you sure you want to delete this transaction?')) return;
          const id = e.currentTarget.getAttribute('data-id');
          try {
            const res = await fetch(`${API_BASE}/eidis/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              loadDashboard();
            } else {
              alert('Failed to delete transaction.');
            }
          } catch (err) {
            console.error('Delete error', err);
          }
        });
      });
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

      buildStatus(status, 'Logging transaction...', false);

      const res = await fetch(`${API_BASE}/eidis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });



      if (res.ok) {
        buildStatus(status, 'Transaction added successfully!', false);
        e.target.reset();
        loadDashboard();
        // Clear success message after 3 seconds
        setTimeout(() => { if (status.textContent === 'Transaction added successfully!') status.textContent = ''; }, 3000);
      } else {
        buildStatus(status, 'Error logging data', true);
      }
    });

    document.getElementById('signOut')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });

    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
      const confirmed = confirm('DANGER: Are you absolutely sure you want to permanently delete your account and ALL your transaction data? This cannot be undone.');
      if (!confirmed) return;
      
      const token = await getToken();
      if (!token) return;
      
      const btn = document.getElementById('deleteAccountBtn');
      const originalText = btn.textContent;
      btn.textContent = 'Deleting...';
      btn.disabled = true;
      
      try {
        const res = await fetch(`${API_BASE}/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          alert('Your account and all associated data have been permanently deleted.');
          await supabase.auth.signOut();
          window.location.href = 'index.html';
        } else {
          const err = await res.json();
          alert(`Failed to delete account: ${err.error || 'Server error'}`);
          btn.textContent = originalText;
          btn.disabled = false;
        }
      } catch (e) {
        alert('Network error while deleting account.');
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

  }

  if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
    const form = document.getElementById('loginForm');
    const status = document.getElementById('status');
    const signUpBtn = document.getElementById('signUpBtn');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('password');

    togglePasswordBtn?.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const eyeIcon = document.getElementById('eyeIcon');
      if (type === 'text') {
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />`;
      } else {
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
      }
    });

    // If already signed in, redirect
    const token = await getToken();
    if (token) {
      window.location.href = 'dashboard.html';
      return;
    }

    const handleAuth = async (isSignUp) => {
      const email = document.getElementById('email')?.value?.trim();
      const password = document.getElementById('password')?.value;

      if (!email || !password) {
        buildStatus(status, 'Please enter both email and password.', true);
        return;
      }

      buildStatus(status, isSignUp ? 'Creating account...' : 'Logging in...', false);

      const { data, error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        let errorMsg = error.message;
        if (!isSignUp && errorMsg.toLowerCase().includes('invalid login credentials')) {
           errorMsg += " (If you used Magic Link before, you must click 'Create Account' to set a password)";
        }
        buildStatus(status, `Error: ${errorMsg}`, true);
      } else {
        if (isSignUp && data?.user?.identities?.length === 0) {
          buildStatus(status, 'This account already exists. Please log in instead.', true);
        } else if (isSignUp) {
          buildStatus(status, 'Account created! If email confirmation is enabled on Supabase, check your inbox. Otherwise, log in now.', false);
        } else {
          buildStatus(status, 'Success! Redirecting to dashboard...', false);
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
        }
      }
    };

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAuth(false);
    });

    signUpBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      // Use native HTML5 validate check to ensure fields are filled before attempting sign up
      if (form.checkValidity()) {
        handleAuth(true);
      } else {
        form.reportValidity();
      }
    });
  }
};

// Execute init immediately (since type="module" defers execution naturally)
initApp();