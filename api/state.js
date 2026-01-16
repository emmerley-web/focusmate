import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  // SET CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const stateFilePath = path.join(__dirname, '../focusmate-state.json');
      const data = await readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(data);
      
      // Recalculate banking on load to ensure consistency
      const recalculatedState = recalculateBanking(state);
      
      console.log('✅ /api/state GET returning:', {
        weeks: Object.keys(recalculatedState.allWeeksData || {}),
        goals: Object.keys(recalculatedState.allWeeklyGoals || {}),
        sessions: (recalculatedState.sessions || []).length
      });
      
      res.status(200).json(recalculatedState);
    } catch (error) {
      console.error('❌ Error reading state file:', error.message);
      // Return empty state instead of error - frontend will handle with localStorage
      res.status(200).json({
        allWeeksData: {},
        allWeeklyGoals: {},
        sessions: [],
        lastModified: new Date().toISOString()
      });
    }
  } else if (req.method === 'POST') {
    try {
      const stateFilePath = path.join(__dirname, '../focusmate-state.json');
      const { allWeeksData, allWeeklyGoals, sessions, lastModified } = req.body;
      
      // Recalculate banking before saving to ensure consistency
      const recalculatedWeeksData = recalculateBanking({
        allWeeksData: allWeeksData || {},
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || []
      }).allWeeksData;
      
      const state = {
        allWeeksData: recalculatedWeeksData,
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || [],
        lastModified: lastModified || new Date().toISOString()
      };
      
      await writeFile(stateFilePath, JSON.stringify(state, null, 2));
      
      console.log('💾 /api/state POST saved:', {
        weeks: Object.keys(state.allWeeksData),
        goals: Object.keys(state.allWeeklyGoals),
        sessions: state.sessions.length,
        bankedUnits: Object.values(state.allWeeksData).reduce((sum, week) => sum + (week.bankedForNextWeek || 0), 0)
      });
      
      res.status(200).json({ success: true, state });
    } catch (error) {
      console.error('❌ Error saving state:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Recalculate banking across all weeks to ensure consistency
 * Banking flows: Week 1 surplus → Week 2 bankedFromPrevious → Week 2 surplus → Week 3, etc.
 */
function recalculateBanking(state) {
  const allWeeksData = state.allWeeksData || {};
  
  // Sort weeks by week number
  const weekKeys = Object.keys(allWeeksData).sort((a, b) => {
    const weekA = parseInt(a.split('_')[1]);
    const weekB = parseInt(b.split('_')[1]);
    return weekA - weekB;
  });

  if (weekKeys.length === 0) {
    return state;
  }

  // Recalculate banking chain
  let previousBankedForNext = 0;
  
  weekKeys.forEach((weekKey) => {
    const week = allWeeksData[weekKey];
    
    // Banked from previous week is what we carried forward
    week.bankedFromPrevious = previousBankedForNext;
    
    // How many units do we need after banked units?
    const unitsNeeded = Math.max(0, (week.target || 40) - week.bankedFromPrevious);
    
    // How many units did we actually complete?
    const completed = week.completed || 0;
    
    // Surplus is anything over what we needed
    week.surplus = Math.max(0, completed - unitsNeeded);
    
    // What we bank for next week is previous banked + new surplus
    week.bankedForNextWeek = week.bankedFromPrevious + week.surplus;
    
    // Update for next iteration
    previousBankedForNext = week.bankedForNextWeek;
    
    console.log(`Week ${week.weekNum}: completed=${completed}, target=${week.target}, banked_from_prev=${week.bankedFromPrevious}, surplus=${week.surplus}, bank_for_next=${week.bankedForNextWeek}`);
  });

  return {
    ...state,
    allWeeksData
  };
}
