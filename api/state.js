import { put, get } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      console.log('[GET /api/state] Starting GET request');
      console.log('[GET] VERCEL_BLOB_READ_WRITE_TOKEN exists:', !!process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
      
      try {
        const blob = await get('focusmate-state.json');
        console.log('[GET] ✅ Successfully retrieved blob');
        console.log('[GET] Blob type:', typeof blob);
        console.log('[GET] Blob length:', blob ? blob.length : 'null');
        
        if (!blob) {
          console.log('[GET] ⚠️ Blob is null/empty');
          return res.status(200).json({ allWeeksData: {}, allWeeklyGoals: {} });
        }
        
        const state = JSON.parse(blob);
        console.log('[GET] ✅ Parsed blob successfully');
        console.log('[GET] State keys:', Object.keys(state));
        console.log('[GET] allWeeksData keys:', Object.keys(state.allWeeksData || {}));
        
        return res.status(200).json(state);
      } catch (error) {
        console.log('[GET] ❌ Error reading blob:', error.message);
        console.log('[GET] Falling back to empty state');
        return res.status(200).json({ allWeeksData: {}, allWeeklyGoals: {} });
      }
    }

    if (req.method === 'POST') {
      console.log('[POST /api/state] Incoming POST request');
      console.log('[POST] Body size:', JSON.stringify(req.body).length, 'bytes');
      console.log('[POST] Body keys:', Object.keys(req.body));
      
      const { allWeeksData, allWeeklyGoals } = req.body;
      
      console.log('[POST] allWeeksData keys:', Object.keys(allWeeksData || {}));
      console.log('[POST] allWeeklyGoals keys:', Object.keys(allWeeklyGoals || {}));
      
      if (!allWeeksData || !allWeeklyGoals) {
        console.log('[POST] ❌ Missing required fields');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const stateData = {
        allWeeksData,
        allWeeklyGoals,
        lastModified: new Date().toISOString(),
      };

      console.log('[POST] Attempting to save to Vercel Blob...');
      console.log('[POST] VERCEL_BLOB_READ_WRITE_TOKEN exists:', !!process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
      
      try {
        await put('focusmate-state.json', JSON.stringify(stateData), {
          access: 'public',
        });
        console.log('[POST] ✅ Successfully saved to Vercel Blob');
        return res.status(200).json({ success: true });
      } catch (saveError) {
        console.log('[POST] ❌ Error saving to blob:', saveError.message);
        throw saveError;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[API ERROR] Unhandled error:', error);
    return res.status(500).json({ error: error.message });
  }
}
