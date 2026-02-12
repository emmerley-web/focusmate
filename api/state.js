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
      }
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
        allWeeksData: allWeeksData || {},
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
