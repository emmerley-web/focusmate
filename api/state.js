import { put, get } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DEBUG');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'DEBUG') {
      try {
        const blob = await get('focusmate-state.json');
        console.log('Blob type:', typeof blob);
        console.log('Blob value:', blob);
        console.log('Blob length:', blob.length);
        return res.status(200).json({ 
          blobType: typeof blob, 
          blobLength: blob ? blob.length : 0,
          blobPreview: blob ? blob.substring(0, 100) : 'EMPTY'
        });
      } catch (error) {
        return res.status(200).json({ error: error.message });
      }
    }

    if (req.method === 'GET') {
      try {
        const blob = await get('focusmate-state.json');
        const state = JSON.parse(blob);
        return res.status(200).json(state);
      } catch (error) {
        // File doesn't exist yet
        return res.status(200).json({});
      }
    }

    if (req.method === 'POST') {
      const { allWeeksData, allWeeklyGoals } = req.body;
      
      if (!allWeeksData || !allWeeklyGoals) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const stateData = {
        allWeeksData,
        allWeeklyGoals,
        lastModified: new Date().toISOString(),
      };

      await put('focusmate-state.json', JSON.stringify(stateData), {
        access: 'public',
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
