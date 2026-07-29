import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  companyId: z.string().nullable().optional(),
  operationScope: z.enum(['SECURITY_GUARDING', 'FACILITY_MANAGEMENT']).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.surveyConfig.view', 'precontract.config.manage']);
    const templates = await prisma.surveyTemplate.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['precontract.surveyConfig.manage']);
    const body = await request.json();
    const data = createSchema.parse(body);

    const template = await prisma.$transaction(async (tx) => {
      const t = await tx.surveyTemplate.create({
        data: {
          title: data.title,
          description: data.description,
          companyId: data.companyId,
          operationScope: data.operationScope,
          createdBy: user.id || 'system',
          updatedBy: user.id || 'system',
        }
      });

      await tx.surveyTemplateVersion.create({
        data: {
          templateId: t.id,
          versionNumber: 1,
          status: 'DRAFT',
          createdBy: user.id || 'system',
          updatedBy: user.id || 'system',
        }
      });

      return t;
    });

    return NextResponse.json(template);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: 400 });
  }
}
