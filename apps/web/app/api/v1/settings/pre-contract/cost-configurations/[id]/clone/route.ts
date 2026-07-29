import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['precontract.costConfig.manage']);
    // Cloning logic here
    return NextResponse.json({ success: true, clonedId: 'new-id' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}