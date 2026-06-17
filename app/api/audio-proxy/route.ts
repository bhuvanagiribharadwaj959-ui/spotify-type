import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const headers: HeadersInit = {
      'Origin': 'https://www.jiosaavn.com',
      'Referer': 'https://www.jiosaavn.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstream = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    
    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      console.error('Audio proxy failed with status:', upstream.status);
      return NextResponse.json({ error: 'Failed to fetch audio stream' }, { status: 502 });
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

    responseHeaders.set('Cache-Control', 'public, max-age=3600');
    // Enable CORS for frontend
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Audio proxy error:', error.message);
    return NextResponse.json({ error: 'Audio proxy failed' }, { status: 500 });
  }
}
