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
          state = JSON.parse(JSON.stringify(DEFAULT_STATE));
          state.lastModified = new Date().toISOString();
        } else {
          // Handle both string and Buffer types
          const blobString = typeof blob === 'string' ? blob : blob.toString();
          state = JSON.parse(blobString);
          
          // Validate state structure
          if (!state.allWeeksData) state.allWeeksData = {};
          if (!state.allWeeklyGoals) state.allWeeklyGoals = {};
          if (!state.sessions) state.sessions = [];
          
          console.log('📦 Loaded from Blob:', {
            weeks: Object.keys(state.allWeeksData || {}),
            goals: Object.keys(state.allWeeklyGoals || {})
          });
        }
      } catch (error) {
        console.log('📦 Blob read failed, using default:', error.message);
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        state.lastModified = new Date().toISOString();
      }

      return res.status(200).json(state);
    } else if (req.method === 'POST') {
      // WRITE to Blob - FIX: Parse JSON body properly
      let bodyData;
      try {
        // Handle both parsed object and string body
        if (typeof req.body === 'string') {
          bodyData = JSON.parse(req.body);
        } else if (typeof req.body === 'object') {
          bodyData = req.body;
        } else {
          throw new Error('Invalid body type');
        }
      } catch (parseError) {
        console.error('❌ Failed to parse request body:', parseError.message);
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

      try {
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
      } catch (blobError) {
        console.error('❌ Failed to write to Blob:', blobError.message);
        return res.status(500).json({ 
          error: 'Failed to save state',
          details: blobError.message 
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
    // Don't return 500 - return partial state so frontend doesn't break
    return res.status(200).json({
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      error: error.message
    });
  }
}
