import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const createSchema = z.object({
  clientName: z.string().min(1),
  contactPerson: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  companyId: z.string().nullable().optional(),
  operationScope: z.enum(['SECURITY_GUARDING', 'FACILITY_MANAGEMENT']).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.prospectClient.manage']);
    const body = await request.json();
    const data = createSchema.parse(body);

    // Duplicate detection - naive implementation
    const existing = await prisma.preContractProspectClient.findFirst({
      where: {
        clientName: data.clientName,
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Possible duplicate prospect client name detected.' }, { status: 409 });
    }

    const prospect = await prisma.preContractProspectClient.create({
      data: {
        clientName: data.clientName,
        contactPerson: data.contactPerson,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        companyId: data.companyId,
        operationScope: data.operationScope,
        createdBy: user.id || 'system',
        updatedBy: user.id || 'system',
      }
    });

    return NextResponse.json(prospect);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.prospectClient.view', 'precontract.prospectClient.manage']);
    
    // In a real system, apply user.companyId / user.operationScope filtering here
    const prospects = await prisma.preContractProspectClient.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(prospects);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 400 });
  }
}
