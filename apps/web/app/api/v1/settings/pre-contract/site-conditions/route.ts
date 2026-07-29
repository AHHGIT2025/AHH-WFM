import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  companyId: z.string().optional(),
  operationScope: z.string().optional(),
  operationType: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.siteConditionConfig.view' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const items = await prisma.siteConditionConfiguration.findMany({
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: error.status || 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: 'precontract.siteConditionConfig.manage' });
    if (auth.error) return auth.error;
    const user = auth.session.user;
    const body = await request.json();
    const data = createSchema.parse(body);

    const item = await prisma.$transaction(async (tx) => {
      const t = await tx.siteConditionConfiguration.create({
        data: {
          name: data.name || data.title || 'Untitled',
          code: data.code || 'CODE_' + Math.random().toString(36).substring(7),
          description: data.description,
          companyId: data.companyId,
          operationType: data.operationType,
          createdBy: user.id || 'system',
          
        }
      });

      
      await tx.siteConditionConfigurationVersion.create({
        data: {
          configurationId: t.id,
          versionNumber: 1,
          status: 'DRAFT',
          effectiveFrom: new Date(),
          createdBy: user.id || 'system',
          
        }
      });
      
      return t;
    });

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: error.status || 400 });
  }
}