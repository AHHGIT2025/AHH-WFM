import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await checkApiAuth(request, ['precontract.costConfig.view']);
    const body = await request.json();
    return NextResponse.json({ success: true, previewResult: {} });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}