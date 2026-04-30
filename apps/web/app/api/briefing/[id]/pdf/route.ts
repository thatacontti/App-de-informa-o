import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  if (!can(session.user.role, 'export:briefing-pdf')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const snapshot = await db.briefingSnapshot.findUnique({
    where: { id: params.id },
    select: { id: true, pdfPath: true, generatedAt: true },
  });
  if (!snapshot?.pdfPath) return new NextResponse('Not found', { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFile(snapshot.pdfPath);
  } catch {
    return new NextResponse('Artefact missing on disk', { status: 410 });
  }

  const isPdf = snapshot.pdfPath.endsWith('.pdf');
  const date = snapshot.generatedAt.toISOString().slice(0, 10);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': isPdf ? 'application/pdf' : 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="briefing-v27-${date}.${isPdf ? 'pdf' : 'html'}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
