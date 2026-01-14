export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const REDIS_URL = process.env.REDIS_URL;

  try {
    if (req.method === 'GET') {
      const response = await fetch(`${REDIS_URL}/get/focusmate-state`);
      const data = await response.json();
      return res.status(200).json(data?.result || {});
    }

    if (req.method === 'POST') {
      const { currentWeek, banked, goals } = req.body;
      
      if (!currentWeek || !goals) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const stateData = JSON.stringify({
        currentWeek,
        banked: banked || 0,
        goals,
        lastModified: new Date().toISOString(),
      });

      const response = await fetch(`${REDIS_URL}/set/focusmate-state`, {
        method: 'POST',
        body: stateData,
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
