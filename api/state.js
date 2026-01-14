export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const REDIS_URL = process.env.REDIS_URL;

  try {
    if (req.method === 'GET') {
      const response = await fetch('https://redis-12350.c261.us-east-1-4.ec2.cloud.redislabs.com:12350', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'GET focusmate-state',
      });
      
      const text = await response.text();
      return res.status(200).json({ result: text });
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

      await fetch('https://redis-12350.c261.us-east-1-4.ec2.cloud.redislabs.com:12350', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `SET focusmate-state ${stateData}`,
      });

      return res.status(2
