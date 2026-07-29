import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const updateSchema = z.any();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await checkApiAuth(request, ['precontract.siteConditionConfig.view']);
    const item = await prisma.siteConditionConfiguration.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } }
    });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['precontract.siteConditionConfig.manage']);
    const body = await request.json();
    const data = updateSchema.parse(body);

    const item = await prisma.siteConditionConfiguration.update({
      where: { id: params.id },
      data: data
    });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}