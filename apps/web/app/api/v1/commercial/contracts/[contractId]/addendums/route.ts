import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.addendum.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId },
      include: {
        client: true,
        addendums: {
          include: {
            lineItems: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        operationType: contract.operationType,
        mobilisationStatus: contract.mobilisationStatus,
        startDate: contract.startDate,
        endDate: contract.endDate,
        totalContractValue: contract.totalContractValue,
        client: contract.client ? { id: contract.client.id, name: contract.client.name } : null
      },
      addendums: contract.addendums
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch contract addendums." },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.addendum.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Business Rule: Addendums are only permitted for ACTIVE or APPROVED contracts
    if (contract.status !== "ACTIVE" && contract.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Contract scope addendums are only permitted for ACTIVE contracts. Current status: ${contract.status}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { addendumId, title, addendumType, effectiveFrom, effectiveTo, description, commercialImpact, calculatedCommercialImpact, lineItems } = body;

    // Check immutability if updating an existing addendum
    if (addendumId) {
      const existingAddendum = await prisma.manpowerContractAddendum.findUnique({
        where: { id: addendumId }
      });
      if (existingAddendum && existingAddendum.status === "APPROVED") {
        return NextResponse.json(
          { error: "Approved addendums are locked and immutable. Direct edits are prohibited." },
          { status: 400 }
        );
      }
    }

    if (!title || !addendumType || !effectiveFrom) {
      return NextResponse.json(
        { error: "title, addendumType, and effectiveFrom are required fields." },
        { status: 400 }
      );
    }

    const count = await prisma.manpowerContractAddendum.count({
      where: { contractId: contract.id }
    });
    const addendumNumber = `${contract.contractNumber}-ADD-${String(count + 1).padStart(2, "0")}`;

    const addendum = await prisma.manpowerContractAddendum.create({
      data: {
        contractId: contract.id,
        addendumNumber,
        title,
        addendumDate: new Date(),
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        addendumType,
        description: description || null,
        commercialImpact: commercialImpact || null,
        calculatedCommercialImpact: calculatedCommercialImpact ? Number(calculatedCommercialImpact) : null,
        status: "DRAFT",
        lineItems: Array.isArray(lineItems) && lineItems.length > 0 ? {
          create: lineItems.map((item: any) => ({
            itemType: item.itemType || "MANPOWER",
            changeType: item.changeType || "ADD",
            itemName: item.itemName,
            quantity: Number(item.quantity) || 1,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
            billingFrequency: item.billingFrequency || "MONTHLY",
            isFoc: Boolean(item.isFoc),
            lineTotal: item.lineTotal ? Number(item.lineTotal) : ((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)),
            remarks: item.remarks || null
          }))
        } : undefined
      },
      include: {
        lineItems: true
      }
    });

    return NextResponse.json({
      success: true,
      addendum
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create contract addendum." },
      { status: 400 }
    );
  }
}
