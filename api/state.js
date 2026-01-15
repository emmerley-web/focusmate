const fs = require('fs');
const path = require('path');
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
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      console.log('📄 State file not found, returning empty state');
      return { 
        allWeeksData: {}, 
        allWeeklyGoals: {}, 
        sessions: [],
        lastModified: new Date().toISOString() 
      };
    }
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
    }

    const content = JSON.stringify(state, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: STATE_FILE,
      message: '💾 Auto-save: FocusMate state updated',
      content: encodedContent,
      ...(sha && { sha })
    });

    console.log('[POST] ✅ Saved to GitHub successfully');
  } catch (error) {
    console.error('[POST] ❌ Failed to save to GitHub:', error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      console.log('🔍 GET /api/state');
      const state = await getStateFromGitHub();
      console.log('✅ Returning state with', Object.keys(state.allWeeksData).length, 'weeks and', state.sessions?.length || 0, 'sessions');
      return res.status(200).json(state);
    }

    if (req.method === 'POST') {
      console.log('🔍 POST /api/state');
      const { allWeeksData, allWeeklyGoals, sessions } = req.body;

      const state = {
        allWeeksData: allWeeksData || {},
        allWeeklyGoals: allWeeklyGoals || {},
        sessions: sessions || [],
        lastModified: new Date().toISOString()
      };

      await saveStateToGitHub(state);
      return res.status(200).json({ success: true, message: 'State saved' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
