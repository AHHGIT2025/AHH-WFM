import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../lib/api-guards";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.renewal.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const { searchParams } = new URL(req.url);
    const operationType = searchParams.get("operationType");
    const status = searchParams.get("status");

    let companyId = user.companyId || undefined;
    if (user.role === "SUPER_ADMIN") {
      companyId = undefined;
    }

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (status && status !== "ALL") where.status = status;

    const renewalCases = await prisma.manpowerContractRenewalCase.findMany({
      where,
      include: {
        contract: {
          include: {
            client: true,
            addendums: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch contracts entering renewal review window or expiring soon
    const activeContracts = await prisma.manpowerContract.findMany({
      where: {
        status: { in: ["ACTIVE", "EXPIRED"] },
        ...(operationType && operationType !== "ALL" ? { operationType } : {})
      },
      include: {
        client: true,
        renewalCases: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { endDate: "asc" }
    });

    const now = new Date();
    const expiringContracts = activeContracts.map((contract) => {
      const endDate = new Date(contract.endDate);
      const diffMs = endDate.getTime() - now.getTime();
      const daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const noticeDays = contract.noticePeriodDays || null;
      const isInNoticeWindow = noticeDays ? daysToExpiry <= noticeDays : daysToExpiry <= 30;

      return {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        operationType: contract.operationType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        noticePeriodDays: noticeDays,
        daysToExpiry,
        isInNoticeWindow,
        client: contract.client ? { id: contract.client.id, name: contract.client.name } : null,
        activeRenewalCase: contract.renewalCases[0] || null
      };
    });

    return NextResponse.json({
      success: true,
      renewalCases,
      expiringContracts
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch contract renewals." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.renewal.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const body = await req.json();
    const { contractId, targetStartDate, targetEndDate, reviewNotes } = body;

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required." }, { status: 400 });
    }

    const contract = await prisma.manpowerContract.findUnique({
      where: { id: contractId },
      include: { client: true }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Check if an active UNDER_REVIEW renewal case already exists to prevent duplicates
    const existingActiveCase = await prisma.manpowerContractRenewalCase.findFirst({
      where: {
        contractId: contract.id,
        status: "UNDER_REVIEW"
      }
    });

    if (existingActiveCase) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        renewalCase: existingActiveCase
      });
    }

    const count = await prisma.manpowerContractRenewalCase.count();
    const caseNumber = `REN-${contract.contractNumber}-${String(count + 1).padStart(2, "0")}`;

    const renewalCase = await prisma.manpowerContractRenewalCase.create({
      data: {
        contractId: contract.id,
        caseNumber,
        status: "UNDER_REVIEW",
        noticePeriodDays: contract.noticePeriodDays || null,
        targetStartDate: targetStartDate ? new Date(targetStartDate) : null,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
        decisionNotes: reviewNotes || null,
        companyId: user.companyId || null,
        operationType: contract.operationType,
        createdById: user.id || "system",
        createdByName: user.name || "Commercial Officer"
      },
      include: {
        contract: {
          include: { client: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      renewalCase
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to initiate contract renewal case." },
      { status: 400 }
    );
  }
}
