import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.prospect.manage' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const body = await request.json();
    const data = {
      name: body.clientName || body.name,
      contactPersonName: body.contactPerson,
      crNumber: body.crNumber,
      companyId: body.companyId,
      operationType: body.operationScope || body.operationType,
    };
    if (!data.name) throw new Error('Missing fields');

    const existing = await prisma.preContractProspectClient.findFirst({
      where: { name: data.name }
    });
    if (existing) {
      return NextResponse.json({ error: 'Prospect already exists' }, { status: 400 });
    }

    const prospect = await prisma.preContractProspectClient.create({
      data: {
        name: data.name,
        contactPersonName: data.contactPersonName,
        crNumber: data.crNumber,
        companyId: data.companyId,
        operationType: data.operationType,
      }
    });

    return NextResponse.json(prospect);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.prospect.view' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const prospects = await prisma.preContractProspectClient.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(prospects);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
