const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'emmerley-web';
const REPO_NAME = 'focusmate';
const STATE_FILE = 'focusmate-state.json';

async function getStateFromGitHub() {
  try {
    const response = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: STATE_FILE
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const parsed = JSON.parse(content);
    console.log('✅ Loaded from GitHub:', {
      weeks: Object.keys(parsed.allWeeksData || {}),
      sessions: (parsed.sessions || []).length
    });
    return parsed;
  } catch (error) {
    if (error.status === 404) {
      console.log('⚠️ State file not found, returning empty state');
      return { 
        allWeeksData: {}, 
        allWeeklyGoals: {}, 
        sessions: [],
        lastModified: new Date().toISOString() 
      };
    }
    console.error('❌ Error loading from GitHub:', error.message);
    throw error;
  }
}

async function saveStateToGitHub(state) {
  try {
    let sha;
    try {
      const response = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: STATE_FILE
      });
      sha = response.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
      console.log('📝 File doesn\'t exist yet, will create');
    }

    const content = JSON.stringify(state, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    const response = await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: STATE_FILE,
      message: `💾 Auto-save: FocusMate state updated - ${Object.keys(state.allWeeksData).length} weeks`,
      content: encodedContent,
      ...(sha && { sha })
    });

    console.log('✅ Saved to GitHub successfully');
    console.log('📊 Saved state:', {
      weeks: Object.keys(state.allWeeksData || {}),
      goals: Object.keys(state.allWeeklyGoals || {}),
      sessions: (state.sessions || []).length,
      lastModified: state.lastModified
    });
    
    return response;
  } catch (error) {
    console.error('❌ Failed to save to GitHub:', error.message);
    throw error;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      console.log('🔍 [GET /api/state] Fetching state from GitHub');
      const state = await getStateFromGitHub();
      return res.status(200).json(state);
    }

    if (req.method === 'POST') {
      console.log('🔍 [POST /api/state] Saving state to GitHub');
      const { allWeeksData, allWeeklyGoals, sessions } = req.body;

      // Ensure sessions array is always included
      const state = {
        allWeeksData: allWeeksData || {},
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: Array.isArray(sessions) ? sessions : [],
        lastModified: new Date().toISOString()
      };

      console.log('📦 State to save:', {
        weekKeys: Object.keys(state.allWeeksData),
        sessionCount: state.sessions.length
      });

      await saveStateToGitHub(state);
      return res.status(200).json({ success: true, message: 'State saved' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
