const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANNON_KEY = process.env.SUPABASE_ANNON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANNON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANNON_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANNON_KEY);

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
  ]);

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

app.get('/api/ai-comment', async (req, res) => {
  const user = await getUserFromBearer(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: stats, error: statsError } = await supabase.rpc('eidi_summary_by_user', {
    user_id: user.id,
  });

  // If no custom rpc is available fallback to simple in-server calculation
  let totalReceived = 0;
  let totalSent = 0;
  let countReceived = 0;
  let countSent = 0;

  if (!statsError && stats && stats.length > 0) {
    totalReceived = stats[0].total_received || 0;
    totalSent = stats[0].total_sent || 0;
    countReceived = stats[0].count_received || 0;
    countSent = stats[0].count_sent || 0;
  } else {
    const received = await supabase.from('eidis').select('amount').eq('user_id', user.id).eq('type', 'received');
    const sent = await supabase.from('eidis').select('amount').eq('user_id', user.id).eq('type', 'sent');
    if (received.error || sent.error) {
      return res.status(500).json({ error: received.error?.message || sent.error?.message });
    }
    countReceived = received.data.length;
    countSent = sent.data.length;
    totalReceived = received.data.reduce((sum, row) => sum + (row.amount || 0), 0);
    totalSent = sent.data.reduce((sum, row) => sum + (row.amount || 0), 0);
  }

  const balance = totalReceived - totalSent;
  const summary = `You received PKR ${totalReceived.toLocaleString()} from ${countReceived} entries and sent PKR ${totalSent.toLocaleString()} in ${countSent} entries. Your balance is PKR ${balance.toLocaleString()}.`;

  if (!OPENAI_API_KEY) {
    return res.json({ comment: `${summary} (AI comments disabled; set OPENAI_API_KEY to enable smart analysis)` });
  }

  try {
    const prompt = `You are a friendly assistant analyzing Eidi statistics. \nUser stats:\n- received: ${totalReceived}\n- sent: ${totalSent}\n- received entries: ${countReceived}\n- sent entries: ${countSent}\n- balance: ${balance}\nProvide a short motivational comment and one tip about sharing and saving with Pakistani context.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'You are an analyst for a personal Eidi tracker.' }, { role: 'user', content: prompt }],
        max_tokens: 160,
        temperature: 0.77,
      }),
    });

    const data = await response.json();

    const comment =
      data?.choices?.[0]?.message?.content ||
      'Nice job tracking your Eidi; keep it up and consider saving more for future needs.';

    res.json({ comment: `${summary}\n\n${comment}` });
  } catch (err) {
    console.error('OpenAI error', err);
    res.json({ comment: `${summary} (AI generation failed; using simple stat summary)` });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Eidi Logger backend listening on http://localhost:${PORT}`);
});

module.exports = app;
