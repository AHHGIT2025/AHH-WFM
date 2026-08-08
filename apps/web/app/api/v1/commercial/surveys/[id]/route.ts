import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const surveyId = params.id;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.view") ||
    hasPermission(user, "commercial.surveys.view") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view commercial site survey details." },
      { status: 403 }
    );
  }

  try {
    const survey = await prisma.preContractSurvey.findUnique({
      where: { id: surveyId },
      include: {
        case: {
          include: {
            prospectClient: true
          }
        },
        prospectiveSite: true,
        snapshot: true,
        responses: {
          include: {
            evidences: {
              include: {
                attachment: true
              }
            }
          }
        },
        siteConditions: true
      }
    });

    if (!survey) {
      return NextResponse.json({ error: "Commercial site survey not found." }, { status: 404 });
    }

    // Company Boundary Check
    if (user?.companyId && !isAdminUser(user) && survey.companyId && survey.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (survey.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (survey.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    // Fetch associated Central Workflow Instance & Audit History
    const workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: surveyId,
        moduleType: "PRE_CONTRACT_SURVEY"
      },
      include: {
        history: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    // Parse Snapshot JSON safely if present
    let parsedSnapshot = null;
    if (survey.snapshot?.snapshotJson) {
      try {
        parsedSnapshot = JSON.parse(survey.snapshot.snapshotJson);
      } catch (e) {}
    }

    return NextResponse.json({
      survey,
      parsedSnapshot,
      workflowInstance
    });
  } catch (error: any) {
    console.error("COMMERCIAL SITE SURVEY GET BY ID ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch commercial site survey details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const surveyId = params.id;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.manage") ||
    hasPermission(user, "commercial.surveys.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to update commercial site surveys." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      conductedBy,
      conductedAt,
      prospectiveSite,
      responses,
      siteConditions,
      attachments
    } = body;

    const existing = await prisma.preContractSurvey.findUnique({
      where: { id: surveyId },
      include: { prospectiveSite: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Commercial site survey not found." }, { status: 404 });
    }

    // Approved Survey Immutability Policy Enforcement (COMPLETED = APPROVED / CANCELLED = REJECTED)
    if (existing.lifecycle === "COMPLETED" || existing.lifecycle === "CANCELLED") {
      return NextResponse.json(
        { error: "Approved survey evidence is immutable. Create a revision survey to modify survey data." },
        { status: 400 }
      );
    }

    // Company Boundary Check
    if (user?.companyId && !isAdminUser(user) && existing.companyId && existing.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (existing.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (existing.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    // 1. Update Prospective Site Details if provided
    if (prospectiveSite && existing.prospectiveSiteId) {
      await prisma.preContractProspectiveSite.update({
        where: { id: existing.prospectiveSiteId },
        data: {
          ...(prospectiveSite.name && { name: prospectiveSite.name.trim() }),
          ...(prospectiveSite.address !== undefined && { address: prospectiveSite.address }),
          ...(prospectiveSite.latitude !== undefined && { latitude: prospectiveSite.latitude ? parseFloat(prospectiveSite.latitude) : null }),
          ...(prospectiveSite.longitude !== undefined && { longitude: prospectiveSite.longitude ? parseFloat(prospectiveSite.longitude) : null }),
          ...(prospectiveSite.approximateArea !== undefined && { approximateArea: prospectiveSite.approximateArea ? parseFloat(prospectiveSite.approximateArea) : null })
        }
      });
    }

    // 2. Upsert Structured Responses if provided
    if (Array.isArray(responses)) {
      for (const resp of responses) {
        if (!resp.elementCode) continue;

        const existingResp = await prisma.surveyResponse.findFirst({
          where: {
            surveyId,
            elementCode: resp.elementCode
          }
        });

        if (existingResp) {
          const updatedResp = await prisma.surveyResponse.update({
            where: { id: existingResp.id },
            data: {
              textValue: resp.textValue ?? null,
              numericValue: resp.numericValue !== undefined && resp.numericValue !== null ? parseFloat(resp.numericValue) : null,
              booleanValue: resp.booleanValue ?? null,
              jsonValue: resp.jsonValue ?? null,
              notes: resp.notes ?? null,
              updatedAt: new Date()
            }
          });

          // Link Attachment Evidence if provided
          if (resp.attachmentId) {
            await prisma.surveyResponseEvidence.create({
              data: {
                responseId: updatedResp.id,
                attachmentId: resp.attachmentId
              }
            });
          }
        } else {
          const createdResp = await prisma.surveyResponse.create({
            data: {
              surveyId,
              elementCode: resp.elementCode,
              textValue: resp.textValue ?? null,
              numericValue: resp.numericValue !== undefined && resp.numericValue !== null ? parseFloat(resp.numericValue) : null,
              booleanValue: resp.booleanValue ?? null,
              jsonValue: resp.jsonValue ?? null,
              notes: resp.notes ?? null
            }
          });

          if (resp.attachmentId) {
            await prisma.surveyResponseEvidence.create({
              data: {
                responseId: createdResp.id,
                attachmentId: resp.attachmentId
              }
            });
          }
        }
      }
    }

    // 3. Upsert Site Condition Observations if provided
    if (Array.isArray(siteConditions)) {
      for (const cond of siteConditions) {
        if (!cond.definitionCode) continue;

        const existingCond = await prisma.surveySiteCondition.findFirst({
          where: {
            surveyId,
            definitionCode: cond.definitionCode
          }
        });

        if (existingCond) {
          await prisma.surveySiteCondition.update({
            where: { id: existingCond.id },
            data: {
              definitionVersion: cond.definitionVersion || 1,
              valueJson: cond.valueJson || {},
              assessedSeverity: cond.assessedSeverity || "MEDIUM",
              notes: cond.notes || null,
              clientResponsibility: cond.clientResponsibility ?? false,
              ahhResponsibility: cond.ahhResponsibility ?? false,
              operationalImpactClass: cond.operationalImpactClass || null,
              costImpactClass: cond.costImpactClass || null,
              updatedAt: new Date()
            }
          });
        } else {
          await prisma.surveySiteCondition.create({
            data: {
              surveyId,
              definitionCode: cond.definitionCode,
              definitionVersion: cond.definitionVersion || 1,
              valueJson: cond.valueJson || {},
              assessedSeverity: cond.assessedSeverity || "MEDIUM",
              notes: cond.notes || null,
              clientResponsibility: cond.clientResponsibility ?? false,
              ahhResponsibility: cond.ahhResponsibility ?? false,
              operationalImpactClass: cond.operationalImpactClass || null,
              costImpactClass: cond.costImpactClass || null
            }
          });
        }
      }
    }

    // 4. Update Survey Header
    const updatedSurvey = await prisma.preContractSurvey.update({
      where: { id: surveyId },
      data: {
        ...(conductedBy && { conductedBy: conductedBy.trim() }),
        ...(conductedAt && { conductedAt: new Date(conductedAt) }),
        updatedAt: new Date()
      },
      include: {
        case: { select: { id: true, title: true } },
        prospectiveSite: true,
        responses: true,
        siteConditions: true
      }
    });

    return NextResponse.json({ survey: updatedSurvey });
  } catch (error: any) {
    console.error("COMMERCIAL SITE SURVEY PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update commercial site survey." },
      { status: 500 }
    );
  }
}
