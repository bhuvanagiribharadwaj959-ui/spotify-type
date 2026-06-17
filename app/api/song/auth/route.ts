import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing encrypted url parameter' }, { status: 400 });
  }

  try {
    const authUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(url)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
    const authRes = await fetch(authUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!authRes.ok) {
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 502 });
    }

    const authData = await authRes.json();
    if (authData.status === 'success' && authData.auth_url) {
      const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(authData.auth_url)}`;
      return NextResponse.json({ audioUrl: proxiedUrl });
    }

    return NextResponse.json({ error: 'Invalid token response' }, { status: 500 });
  } catch (error: any) {
    console.error('Auth proxy error:', error.message);
    return NextResponse.json({ error: 'Auth proxy failed' }, { status: 500 });
  }
}
