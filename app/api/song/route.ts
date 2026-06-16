import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { id, title, artist } = await req.json();

    if (!id || !title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'fetch_song_data.py');
    const cacheDir = path.join(process.cwd(), 'public', 'cache');

    return new Promise<NextResponse>((resolve) => {
      // Execute the python script inside the .venv
      const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
      const cmd = `${venvPython} ${scriptPath} "${id}" "${artist}" "${title}" "${cacheDir}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          console.error(`stderr: ${stderr}`);
          resolve(NextResponse.json({ error: 'Failed to fetch song data' }, { status: 500 }));
          return;
        }
        try {
          const jsonString = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
          const result = JSON.parse(jsonString);
          resolve(NextResponse.json(result));
        } catch (e) {
          console.error("Failed to parse JSON output from python script", stdout);
          resolve(NextResponse.json({ error: 'Invalid response from parser' }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error("API error", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
