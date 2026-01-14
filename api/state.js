import { kv } from '@vercel/kv';

export const runtime = 'edge';

export async function GET() {
  try {
    const state = await kv.get('focusmate-state');
    return Response.json(state || {});
  } catch (error) {
    return Response.json({ error: 'Failed to load state' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { currentWeek, banked, goals, lastModified } = body;
    
    if (!currentWeek || !goals) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await kv.set('focusmate-state', {
      currentWeek,
      banked: banked || 0,
      goals,
      lastModified: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to save state' }, { status: 500 });
  }
}
