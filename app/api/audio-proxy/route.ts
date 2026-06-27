import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing target audio URL', { status: 400 });
  }

  // Forward the Range headers requested by the client browser (<audio> tag)
  const clientHeaders = new Headers();
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    clientHeaders.set('Range', rangeHeader);
  }

  // Spoof Saavn-friendly identity signatures
  clientHeaders.set('User-Agent', 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36');
  clientHeaders.set('Referer', 'https://www.jiosaavn.com/');

  try {
    const saavnResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: clientHeaders,
    });

    // Check for standard stream success statuses (200 OK or 206 Partial Content)
    if (!saavnResponse.ok && saavnResponse.status !== 206) {
      return new NextResponse('CDN streaming failed', { status: saavnResponse.status });
    }

    // Capture the exact range headers returned from Saavn's CDN
    const proxyHeaders = new Headers();
    const contentRange = saavnResponse.headers.get('Content-Range');
    const contentLength = saavnResponse.headers.get('Content-Length');
    const contentType = saavnResponse.headers.get('Content-Type') || 'audio/mp4';

    if (contentRange) proxyHeaders.set('Content-Range', contentRange);
    if (contentLength) proxyHeaders.set('Content-Length', contentLength);
    proxyHeaders.set('Content-Type', contentType);
    proxyHeaders.set('Accept-Ranges', 'bytes');
    proxyHeaders.set('Access-Control-Allow-Origin', '*');

    // CRUCIAL STEP: Pass the underlying body stream directly without awaiting it
    return new NextResponse(saavnResponse.body, {
      status: saavnResponse.status, // Safely forwards 206 if requested
      headers: proxyHeaders,
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    return new NextResponse('Internal Proxy Timeout', { status: 500 });
  }
}
