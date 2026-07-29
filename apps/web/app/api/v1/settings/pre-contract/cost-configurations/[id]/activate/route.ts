import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['precontract.config.activate', 'precontract.costConfig.manage']);
    // Activation logic here
    return NextResponse.json({ success: true, status: 'ACTIVE' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}