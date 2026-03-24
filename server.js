const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANNON_KEY = process.env.SUPABASE_ANNON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANNON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANNON_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANNON_KEY);
const supabaseAdmin = SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('public'));

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.split(' ')[1];
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Eidi Logger API is running' });
});

app.get('/api/config', (req, res) => {
  res.json({
    SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANNON_KEY,
  });
});

app.get('/api/eidis', async (req, res) => {
  const user = await getUserFromBearer(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('eidis')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ data });
});

app.post('/api/eidis', async (req, res) => {
  const user = await getUserFromBearer(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { type, amount, sender_name, notes } = req.body;
  if (!['received', 'sent'].includes(type)) {
    return res.status(400).json({ error: 'type must be received or sent' });
  }
  if (!amount || isNaN(Number(amount))) {
    return res.status(400).json({ error: 'amount is required and must be a number' });
  }

  const { data, error } = await supabase.from('eidis').insert([
    {
      user_id: user.id,
      type,
      amount: Number(amount),
      sender_name: sender_name || '',
      notes: notes || '',
    },
  ]).select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ data: data[0] });
});

app.get('/api/stats', async (req, res) => {
  const user = await getUserFromBearer(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const received = await supabase
    .from('eidis')
    .select('amount', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('type', 'received');

  const sent = await supabase
    .from('eidis')
    .select('amount', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('type', 'sent');

  if (received.error || sent.error) {
    return res.status(500).json({ error: received.error?.message || sent.error?.message });
  }

  const totalReceived = received.data.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalSent = sent.data.reduce((sum, item) => sum + (item.amount || 0), 0);
  const countReceived = received.data.length;
  const countSent = sent.data.length;

  res.json({
    totalReceived,
    totalSent,
    countReceived,
    countSent,
    balance: totalReceived - totalSent,
  });
});

app.delete('/api/account', async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server missing SUPABASE_SERVICE_KEY. Cannot securely delete auth records.' });
    }

    // 1. Delete all transactions
    const { error: dataError } = await supabase.from('eidis').delete().eq('user_id', user.id);
    if (dataError) {
      console.error('Failed to delete eidis data:', dataError);
      return res.status(500).json({ error: 'Failed to delete user logs.' });
    }

    // 2. Delete Auth User Record
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error('Failed to delete auth user:', authError);
      return res.status(500).json({ error: 'Failed to fully delete user account.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Account delete error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/eidis/:id', async (req, res) => {
  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { error } = await supabase
      .from('eidis')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete Error from Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Unhandled Server Exception in Delete:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Eidi Logger backend listening on http://localhost:${PORT}`);
});

module.exports = app;
