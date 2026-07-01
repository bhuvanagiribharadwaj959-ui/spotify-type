import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate the URL is from a trusted CDN
  const allowedHosts = ['web.saavncdn.com', 'aac.saavncdn.com', 'c.saavncdn.com'];
  try {
    const parsed = new URL(url);
    if (!allowedHosts.some(h => parsed.hostname.endsWith(h))) {
      return NextResponse.json({ error: 'Untrusted audio source' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const audioRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com/'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!audioRes.ok) {
      return NextResponse.json(
        { error: `CDN returned ${audioRes.status}` }, 
        { status: audioRes.status }
      );
    }

    const contentType = audioRes.headers.get('content-type') || 'audio/mp4';
    const contentLength = audioRes.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    };
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Stream the audio data through
    return new NextResponse(audioRes.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Stream proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch audio stream' }, { status: 502 });
  }
}
