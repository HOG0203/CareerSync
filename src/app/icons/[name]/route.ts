import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const safeName = path.basename(name);
  
  // Look in public/icons or public/
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'icons', safeName),
    path.join(process.cwd(), 'public', safeName)
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return new NextResponse('Icon not found', { status: 404 });
}