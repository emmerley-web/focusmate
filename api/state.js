import { put, list } from '@vercel/blob';

const BLOB_PREFIX = 'focusmate-state';
const BLOB_KEY = 'focusmate-state.json';

// Default state if Blob is empty (Week 1 historical data)
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

  // Get week keys sorted numerically
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

async function readStateFromBlob() {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 10 });
    if (blobs.length === 0) {
      return null;
    }

    // Sort by uploadedAt descending to get the most recent blob
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      console.error('Failed to fetch blob content:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to read from Blob:', error.message);
    return null;
  }
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
      let state = await readStateFromBlob();

      if (!state) {
        console.log('Blob empty, returning default state');
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        state.lastModified = new Date().toISOString();
      } else {
        // Validate state structure
        if (!state.allWeeksData) state.allWeeksData = {};
        if (!state.allWeeklyGoals) state.allWeeklyGoals = {};
        if (!state.sessions) state.sessions = [];
      }

      // Fix any corrupted banking data before returning
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

      try {
        await put(BLOB_KEY, JSON.stringify(state, null, 2), {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false
        });

        return res.status(200).json({ success: true, state });
      } catch (blobError) {
        console.error('Failed to write to Blob:', blobError.message);
        return res.status(500).json({
          error: 'Failed to save state',
          details: blobError.message
        });
      }

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
