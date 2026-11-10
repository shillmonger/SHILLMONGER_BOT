import { NextResponse } from 'next/server';
import { getPfpImages } from '@/lib/pfp';

export async function GET() {
  return NextResponse.json({ images: getPfpImages() });
}
