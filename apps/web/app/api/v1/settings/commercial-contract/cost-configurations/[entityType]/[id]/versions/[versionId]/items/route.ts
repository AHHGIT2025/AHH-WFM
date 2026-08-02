// GET  /api/v1/.../packages/[id]/versions/[versionId]/items
// POST /api/v1/.../packages/[id]/versions/[versionId]/items
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import {
  checkApiAuth, parseBody, writeAudit, safeError, PackageItemSchema,
} from "@/lib/server/pc2a-shared";

export async function GET(
  req: Request,
  { params }: { params: { entityType: string; id: string; versionId: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "settings.view" });
    if (auth.error) return auth.error;

    const items = await prisma.costPackageItem.findMany({
      where: { packageVersionId: params.versionId },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return safeError(err) as any;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { entityType: string; id: string; versionId: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    // Verify version exists and is DRAFT
    const version = await (prisma as any).costPackageVersion.findUnique({ where: { id: params.versionId } });
    if (!version || version.masterId !== params.id) {
      return NextResponse.json({ success: false, error: "Package version not found" }, { status: 404 });
    }
    if (version.status !== "DRAFT") {
      return NextResponse.json({ success: false, error: "Cannot add items to a non-DRAFT version" }, { status: 409 });
    }

    const body = await req.json();
    const parsed = parseBody(PackageItemSchema, body);
    if ("error" in parsed) return parsed.error as any;

    const { elementCode, sequence, ...otherFields } = parsed.data as any;

    // Enforce max 200 items
    const existingItems = await prisma.costPackageItem.findMany({
      where: { packageVersionId: params.versionId }
    });

    if (existingItems.length >= 200) {
      return NextResponse.json({ success: false, error: "Package cannot exceed 200 items" }, { status: 409 });
    }

    // Enforce unique element within version
    const duplicate = existingItems.find(it => it.elementCode === elementCode);
    if (duplicate) {
      return NextResponse.json({ success: false, error: "Element already exists in this package version" }, { status: 409 });
    }

    const item = await prisma.costPackageItem.create({
      data: {
        ...otherFields,
        elementCode,
        packageVersionId: params.versionId,
      },
    });

    await writeAudit(user.id, "PACKAGE_ITEM_ADDED", "CostPackageItem", item.id, {
      packageVersionId: params.versionId, elementCode,
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Duplicate item in package version" }, { status: 409 });
    }
    return safeError(err) as any;
  }
}
