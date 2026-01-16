import { put, get } from '@vercel/blob';

const BLOB_KEY = 'focusmate-state.json';

// Default state if Blob is empty
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
      // READ from Blob
      let state;
      try {
        const blob = await get(BLOB_KEY);
        if (!blob) {
          console.log('📦 Blob empty, returning default state');
          state = DEFAULT_STATE;
        } else {
          state = JSON.parse(blob.toString());
          console.log('📦 Loaded from Blob:', {
            weeks: Object.keys(state.allWeeksData || {}),
            goals: Object.keys(state.allWeeklyGoals || {})
          });
        }
      } catch (error) {
        console.log('📦 Blob read failed, using default:', error.message);
        state = DEFAULT_STATE;
      }

      return res.status(200).json(state);
    } else if (req.method === 'POST') {
      // WRITE to Blob
      const { allWeeksData, allWeeklyGoals, sessions, lastModified } = req.body;

      const state = {
        allWeeksData: allWeeksData || {},
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || [],
        lastModified: lastModified || new Date().toISOString()
      };

      await put(BLOB_KEY, JSON.stringify(state, null, 2), {
        access: 'public',
        contentType: 'application/json'
      });

      console.log('💾 Saved to Blob:', {
        weeks: Object.keys(state.allWeeksData),
        goals: Object.keys(state.allWeeklyGoals),
        sessions: state.sessions.length
      });

      return res.status(200).json({ success: true, state });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
    // Don't return 500 - return partial state so frontend doesn't break
    return res.status(200).json({
      ...DEFAULT_STATE,
      error: error.message
    });
  }
}
