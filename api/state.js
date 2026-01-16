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
      
      console.log('✅ /api/state GET returning:', {
        weeks: Object.keys(state.allWeeksData || {}),
        goals: Object.keys(state.allWeeklyGoals || {}),
        sessions: (state.sessions || []).length
      });
      
      res.status(200).json(state);
    } catch (error) {
      console.error('❌ Error reading state file:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const stateFilePath = path.join(__dirname, '../focusmate-state.json');
      const { allWeeksData, allWeeklyGoals, sessions, lastModified } = req.body;
      
      const state = {
        allWeeksData: allWeeksData || {},
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || [],
        lastModified: lastModified || new Date().toISOString()
      };
      
      await writeFile(stateFilePath, JSON.stringify(state, null, 2));
      
      console.log('💾 /api/state POST saved:', {
        weeks: Object.keys(state.allWeeksData),
        goals: Object.keys(state.allWeeklyGoals),
        sessions: state.sessions.length
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Error saving state:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
