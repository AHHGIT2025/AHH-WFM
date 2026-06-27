import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const template = await prisma.clearanceTemplate.findUnique({
      where: { id: params.id },
      include: {
        sections: {
          orderBy: { stepOrder: "asc" }
        }
      }
    });

    if (!template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    console.error("GET /api/v1/clearance/templates/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const id = params.id;
    const data = await request.json();
    const { name, description, isActive, sections } = data;

    const template = await prisma.clearanceTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const updated = await prisma.clearanceTemplate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : template.name,
        description: description !== undefined ? description : template.description,
        isActive: isActive !== undefined ? isActive : template.isActive
      }
    });

    // Update sections if provided
    if (Array.isArray(sections)) {
      // Delete existing
      await prisma.clearanceTemplateSection.deleteMany({
        where: { templateId: id }
      });

      // Create new
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        await prisma.clearanceTemplateSection.create({
          data: {
            templateId: id,
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PATCH /api/v1/clearance/templates/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const id = params.id;

    await prisma.clearanceTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/v1/clearance/templates/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
