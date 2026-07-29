import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const updateSchema = z.any();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.surveyConfig.view' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const item = await prisma.surveyTemplate.findUnique({
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
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.surveyConfig.manage' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const item = await prisma.surveyTemplate.update({
      where: { id: params.id },
      data: data
    });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}