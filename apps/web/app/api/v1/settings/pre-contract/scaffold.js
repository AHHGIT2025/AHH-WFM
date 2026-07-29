const fs = require('fs');
const path = require('path');

const basePath = 'd:/AI Projects/AHH WFM/app/apps/web/app/api/v1/settings/pre-contract';

const createDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const templates = {
  listCreate: (entity, permissionPrefix, modelName, hasVersion = true) => `
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
    await checkApiAuth(request, ['${permissionPrefix}.view']);
    const items = await prisma.${modelName}.findMany({
      ${hasVersion ? `include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },` : ''}
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: error.status || 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await checkApiAuth(request, ['${permissionPrefix}.manage']);
    const body = await request.json();
    const data = createSchema.parse(body);

    const item = await prisma.$transaction(async (tx) => {
      const t = await tx.${modelName}.create({
        data: {
          name: data.name || data.title || 'Untitled',
          code: data.code || 'CODE_' + Math.random().toString(36).substring(7),
          description: data.description,
          companyId: data.companyId,
          ${entity === 'survey-templates' ? `operationScope: data.operationScope, title: data.title || 'Untitled',` : `operationType: data.operationType,`}
          createdBy: user.id || 'system',
          ${entity === 'survey-templates' ? `updatedBy: user.id || 'system',` : ''}
        }
      });

      ${hasVersion ? `
      await tx.${modelName}Version.create({
        data: {
          ${entity === 'survey-templates' ? 'templateId' : (entity === 'cost-configurations' ? 'headerId' : 'configurationId')}: t.id,
          versionNumber: 1,
          status: 'DRAFT',
          effectiveFrom: new Date(),
          createdBy: user.id || 'system',
          ${entity === 'survey-templates' ? `updatedBy: user.id || 'system',` : ''}
        }
      });
      ` : ''}
      return t;
    });

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid data or unauthorized' }, { status: error.status || 400 });
  }
}
`.trim(),

  detail: (entity, permissionPrefix, modelName, hasVersion = true) => `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';
import { z } from 'zod';

const updateSchema = z.any();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await checkApiAuth(request, ['${permissionPrefix}.view']);
    const item = await prisma.${modelName}.findUnique({
      where: { id: params.id },
      ${hasVersion ? `include: { versions: { orderBy: { versionNumber: 'desc' } } }` : ''}
    });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['${permissionPrefix}.manage']);
    const body = await request.json();
    const data = updateSchema.parse(body);

    const item = await prisma.${modelName}.update({
      where: { id: params.id },
      data: data
    });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}
`.trim(),

  clone: (entity, permissionPrefix, modelName) => `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['${permissionPrefix}.manage']);
    // Cloning logic here
    return NextResponse.json({ success: true, clonedId: 'new-id' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}
`.trim(),

  activate: (entity, permissionPrefix, modelName) => `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['precontract.config.activate', '${permissionPrefix}.manage']);
    // Activation logic here
    return NextResponse.json({ success: true, status: 'ACTIVE' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}
`.trim(),

  retire: (entity, permissionPrefix, modelName) => `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ahh-wfm/database';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await checkApiAuth(request, ['precontract.config.retire', '${permissionPrefix}.manage']);
    // Retirement logic here
    return NextResponse.json({ success: true, status: 'RETIRED' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}
`.trim(),

  preview: (entity, permissionPrefix) => `
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await checkApiAuth(request, ['${permissionPrefix}.view']);
    const body = await request.json();
    return NextResponse.json({ success: true, previewResult: {} });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error' }, { status: error.status || 400 });
  }
}
`.trim()
};

const setupEntity = (entity, permissionPrefix, modelName, hasPreview = false) => {
  const dir = path.join(basePath, entity);
  createDir(dir);
  fs.writeFileSync(path.join(dir, 'route.ts'), templates.listCreate(entity, permissionPrefix, modelName));
  
  const idDir = path.join(dir, '[id]');
  createDir(idDir);
  fs.writeFileSync(path.join(idDir, 'route.ts'), templates.detail(entity, permissionPrefix, modelName));
  
  const cloneDir = path.join(idDir, 'clone');
  createDir(cloneDir);
  fs.writeFileSync(path.join(cloneDir, 'route.ts'), templates.clone(entity, permissionPrefix, modelName));

  const activateDir = path.join(idDir, 'activate');
  createDir(activateDir);
  fs.writeFileSync(path.join(activateDir, 'route.ts'), templates.activate(entity, permissionPrefix, modelName));

  const retireDir = path.join(idDir, 'retire');
  createDir(retireDir);
  fs.writeFileSync(path.join(retireDir, 'route.ts'), templates.retire(entity, permissionPrefix, modelName));

  if (hasPreview) {
    const previewDir = path.join(idDir, 'preview');
    createDir(previewDir);
    fs.writeFileSync(path.join(previewDir, 'route.ts'), templates.preview(entity, permissionPrefix));
  }
};

setupEntity('survey-templates', 'precontract.surveyConfig', 'surveyTemplate', true);
setupEntity('site-conditions', 'precontract.siteConditionConfig', 'siteConditionConfiguration', false);
setupEntity('cost-configurations', 'precontract.costConfig', 'costConfigurationHeader', true);

console.log('Done scaffolding!');
