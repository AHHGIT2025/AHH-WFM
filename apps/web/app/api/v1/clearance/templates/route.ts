import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

const defaultSteps = [
  "Employee Declaration",
  "Direct Supervisor",
  "Logistics",
  "Camps & Facilities",
  "Store",
  "Material Controller",
  "Finance Department",
  "Department Manager",
  "General Manager",
  "IT Department",
  "Legal Department",
  "HR Department",
  "Chief HR & Admin Affairs Officer",
  "Chief Executive Officer",
  "Vice Chairman"
];

async function seedDefaultTemplates() {
  const templates = [
    {
      name: "Leave / Vacation Clearance",
      clearanceType: "LEAVE_VACATION",
      description: "Standard clearance template for employee leave / vacation processes."
    },
    {
      name: "Separation Clearance",
      clearanceType: "SEPARATION",
      description: "Standard clearance template for employee separation / exit processes."
    }
  ];

  for (const t of templates) {
    let tRecord = await prisma.clearanceTemplate.findUnique({
      where: { name: t.name }
    });

    if (!tRecord) {
      tRecord = await prisma.clearanceTemplate.create({
        data: {
          name: t.name,
          clearanceType: t.clearanceType,
          description: t.description,
          isActive: true
        }
      });

      // Create sections
      for (let i = 0; i < defaultSteps.length; i++) {
        await prisma.clearanceTemplateSection.create({
          data: {
            templateId: tRecord.id,
            sectionName: defaultSteps[i],
            stepOrder: i + 1,
            isRequiredByDefault: true,
            isExecutive: i >= 12 // Last 3 are executive
          }
        });
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearanceType = searchParams.get("clearanceType");

    // Make sure default templates are seeded
    await seedDefaultTemplates();

    const whereClause: any = {};
    if (clearanceType) {
      whereClause.clearanceType = clearanceType;
    }

    const templates = await prisma.clearanceTemplate.findMany({
      where: whereClause,
      include: {
        sections: {
          orderBy: { stepOrder: "asc" }
        }
      }
    });

    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    console.error("GET /api/v1/clearance/templates error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, clearanceType, description, sections } = data;

    if (!name || !clearanceType) {
      return NextResponse.json({ success: false, error: "Name and clearanceType are required" }, { status: 400 });
    }

    // Check unique name
    const existing = await prisma.clearanceTemplate.findUnique({
      where: { name }
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Template name already exists" }, { status: 400 });
    }

    const template = await prisma.clearanceTemplate.create({
      data: {
        name,
        clearanceType,
        description,
        isActive: true
      }
    });

    // Create sections if provided
    if (Array.isArray(sections)) {
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        await prisma.clearanceTemplateSection.create({
          data: {
            templateId: template.id,
            sectionName: sec.sectionName,
            stepOrder: sec.stepOrder || (i + 1),
            defaultApproverId: sec.defaultApproverId || null,
            defaultApproverRole: sec.defaultApproverRole || null,
            isRequiredByDefault: sec.isRequiredByDefault !== undefined ? sec.isRequiredByDefault : true,
            isExecutive: sec.isExecutive || false,
            conditionalRule: sec.conditionalRule || null
          }
        });
      }
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/templates error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
