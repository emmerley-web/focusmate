import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const state = await redis.get('focusmate-state');
      return res.status(200).json(state || {});
    }

    if (req.method === 'POST') {
      const { currentWeek, banked, goals } = req.body;
      
      if (!currentWeek || !goals) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      await redis.set('focusmate-state', {
        currentWeek,
        banked: banked || 0,
        goals,
        lastModified: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
