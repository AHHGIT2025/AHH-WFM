import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
export async function POST(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.prospectiveSite.manage']);
    const body = await request.json();
    const data = {
      prospectClientId: body.prospectClientId,
      siteName: body.siteName,
      location: body.location,
      companyId: body.companyId,
      operationScope: body.operationScope,
    };
    if (!data.siteName || !data.prospectClientId) throw new Error('Missing fields');

    const site = await prisma.preContractProspectiveSite.create({
      data: {
        prospectClientId: data.prospectClientId,
        siteName: data.siteName,
        location: data.location,
        companyId: data.companyId,
        operationScope: data.operationScope,
        createdBy: user.id || 'system',
        updatedBy: user.id || 'system',
      }
    });

    return NextResponse.json(site);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.prospectiveSite.view', 'precontract.prospectiveSite.manage']);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const sites = await prisma.preContractProspectiveSite.findMany({
      where: clientId ? { prospectClientId: clientId } : undefined,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(sites);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 400 });
  }
}
