import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.prospectiveSite.manage' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const body = await request.json();
    const data = {
      name: body.siteName || body.name,
      address: body.location || body.address,
      companyId: body.companyId,
      operationType: body.operationScope || body.operationType,
    };
    if (!data.name) throw new Error('Missing fields');

    const site = await prisma.preContractProspectiveSite.create({
      data: {
        name: data.name,
        address: data.address,
        companyId: data.companyId,
        operationType: data.operationType,
      }
    });

    return NextResponse.json(site);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.prospectiveSite.view' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    
    // Schema doesn't actually have prospectClientId yet. Let's ignore it for now.
    const sites = await prisma.preContractProspectiveSite.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(sites);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 400 });
  }
}


