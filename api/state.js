export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = 'emmerley-web/focusmate';
  const FILE_PATH = 'focusmate-state.json';
  const GITHUB_API = 'https://api.github.com/repos';

  try {
    if (req.method === 'GET') {
      console.log('[GET] Fetching from GitHub');
      
      try {
        // Public read - no auth needed
        const response = await fetch(
          `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${FILE_PATH}`
        );

        if (response.status === 404) {
          console.log('[GET] File not found, returning empty state');
          return res.status(200).json({ allWeeksData: {}, allWeeklyGoals: {} });
        }

        if (!response.ok) {
          throw new Error(`GitHub returned ${response.status}`);
        }

        const data = await response.text();
        const state = JSON.parse(data);
        console.log('[GET] ✅ Loaded from GitHub');
        console.log('[GET] allWeeksData keys:', Object.keys(state.allWeeksData || {}));
        
        return res.status(200).json(state);
      } catch (error) {
        console.log('[GET] ❌ Error reading from GitHub:', error.message);
        return res.status(200).json({ allWeeksData: {}, allWeeklyGoals: {} });
      }
    }

    if (req.method === 'POST') {
      console.log('[POST] Saving to GitHub');
      
      if (!GITHUB_TOKEN) {
        console.error('[POST] ❌ GITHUB_TOKEN not configured');
        return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
      }

      const { allWeeksData, allWeeklyGoals } = req.body;
      
      if (!allWeeksData || !allWeeklyGoals) {
        console.log('[POST] ❌ Missing required fields');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const stateData = {
        allWeeksData,
        allWeeklyGoals,
        lastModified: new Date().toISOString(),
      };

      try {
        // First, get the current file to get its SHA (needed for updates)
        let sha = null;
        try {
          const getResponse = await fetch(
            `${GITHUB_API}/${GITHUB_REPO}/contents/${FILE_PATH}`,
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );

          if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
            console.log('[POST] Got existing file SHA');
          }
        } catch (e) {
          console.log('[POST] File does not exist yet, will create new');
        }

        // Encode content as base64
        const content = Buffer.from(JSON.stringify(stateData, null, 2)).toString('base64');

        // Write to GitHub
        const putResponse = await fetch(
          `${GITHUB_API}/${GITHUB_REPO}/contents/${FILE_PATH}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Auto-save focusmate state at ${new Date().toISOString()}`,
              content: content,
              sha: sha, // Include SHA if file exists (for update), omit if new file
            }),
          }
        );

        if (!putResponse.ok) {
          const error = await putResponse.json();
          console.error('[POST] GitHub API error:', error);
          throw new Error(`GitHub API returned ${putResponse.status}: ${error.message}`);
        }

        console.log('[POST] ✅ Saved to GitHub successfully');
        console.log('[POST] allWeeksData keys saved:', Object.keys(allWeeksData));
        
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('[POST] ❌ Error saving to GitHub:', error.message);
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[API] Unhandled error:', error);
    return res.status(500).json({ error: error.message });
  }
}
