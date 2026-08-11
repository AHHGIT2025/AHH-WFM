import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.task.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const taskId = params.id;
    const body = await req.json();
    const { status, priority, description, assignedToId, assignedToName, dueAt } = body;

    const existingTask = await prisma.commercialTask.findUnique({
      where: { id: taskId }
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    if (user.role !== "SUPER_ADMIN" && user.companyId && existingTask.companyId && existingTask.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden cross-company task update." }, { status: 403 });
    }

    const updateData: any = {};
    if (status) {
      if (!["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
        return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
      }
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    if (priority) updateData.priority = priority;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (assignedToId) updateData.assignedToId = assignedToId;
    if (assignedToName) updateData.assignedToName = assignedToName;
    if (dueAt !== undefined) updateData.dueAt = dueAt ? new Date(dueAt) : null;

    const updatedTask = await prisma.commercialTask.update({
      where: { id: taskId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      task: updatedTask
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update commercial task." },
      { status: 400 }
    );
  }
}
