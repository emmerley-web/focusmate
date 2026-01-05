export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { start, end } = req.query;
  const apiKey = process.env.FOCUSMATE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'FOCUSMATE_API_KEY not configured. Add it in Vercel dashboard.' 
    });
  }

  if (!start || !end) {
    return res.status(400).json({ 
      error: 'Missing start or end date parameters' 
    });
  }

  try {
    const response = await fetch(
      `https://api.focusmate.com/v1/sessions?start=${start}&end=${end}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `FocusMate API returned ${response.status}`,
        details: text
      });
    }

    const data = await response.json();
    
    // Cache response
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch from FocusMate API',
      details: error.message
    });
  }
}
