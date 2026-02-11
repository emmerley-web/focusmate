import { kv } from '@vercel/kv';

const KV_KEY = 'focusmate-state';

// Default state if KV is empty (Week 1 historical data)
const DEFAULT_STATE = {
  allWeeksData: {
    week_1: {
      weekNum: 1,
      weekStart: '2026-01-05T00:00:00.000Z',
      completed: 42,
      target: 40,
      dailyUnits: {
        Mon: 5,
        Tue: 4,
        Wed: 12,
        Thu: 5,
        Fri: 8,
        Sat: 5,
        Sun: 3
      },
      bankedFromPrevious: 0,
      surplus: 2,
      bankedForNextWeek: 2
    }
  },
  allWeeklyGoals: {
    week_1: [
      { text: '', done: false },
      { text: '', done: false },
      { text: '', done: false }
    ]
  },
  sessions: [],
  lastModified: new Date().toISOString()
};

// Recalculate banking chain to fix any corrupted data.
// Banking rule: surplus = max(0, completed - target), bankedForNextWeek = prevBanked + surplus
function validateBankingChain(allWeeksData) {
  if (!allWeeksData || typeof allWeeksData !== 'object') return allWeeksData;

  const weekKeys = Object.keys(allWeeksData)
    .filter(k => k.startsWith('week_'))
    .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

  for (const key of weekKeys) {
    const week = allWeeksData[key];
    if (!week) continue;

    const weekNum = week.weekNum || parseInt(key.split('_')[1]);
    const prevKey = `week_${weekNum - 1}`;
    const prevWeek = allWeeksData[prevKey];

    const target = week.target || 40;
    const completed = week.completed || 0;
    const bankedFromPrevious = prevWeek ? (prevWeek.bankedForNextWeek || 0) : 0;
    const surplus = Math.max(0, completed - target);
    const bankedForNextWeek = bankedFromPrevious + surplus;

    week.bankedFromPrevious = bankedFromPrevious;
    week.surplus = surplus;
    week.bankedForNextWeek = bankedForNextWeek;
  }

  return allWeeksData;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      let state = await kv.get(KV_KEY);

      if (!state) {
        console.log('KV empty, returning default state');
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        state.lastModified = new Date().toISOString();
      } else {
        if (!state.allWeeksData) state.allWeeksData = {};
        if (!state.allWeeklyGoals) state.allWeeklyGoals = {};
        if (!state.sessions) state.sessions = [];
      }

      state.allWeeksData = validateBankingChain(state.allWeeksData);

      return res.status(200).json(state);

    } else if (req.method === 'POST') {
      let bodyData;
      try {
        if (typeof req.body === 'string') {
          bodyData = JSON.parse(req.body);
        } else if (typeof req.body === 'object') {
          bodyData = req.body;
        } else {
          throw new Error('Invalid body type');
        }
      } catch (parseError) {
        return res.status(400).json({
          error: 'Invalid JSON in request body',
          details: parseError.message
        });
      }

      const { allWeeksData, allWeeklyGoals, sessions } = bodyData;

      const state = {
        allWeeksData: validateBankingChain(allWeeksData || {}),
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || [],
        lastModified: new Date().toISOString()
      };

      await kv.set(KV_KEY, state);

      return res.status(200).json({ success: true, state });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(200).json({
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      error: error.message
    });
  }
}
