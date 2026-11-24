import { NextResponse } from "next/server";
import { prisma, PreContractLifecycle } from "@ahh-wfm/database";
import { checkApiAuth, checkRecordCompanyAccess, resolveCompanyScope } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { findConflictingActiveSurvey, formatDuplicateSurveyMessage } from "@/lib/survey-uniqueness";
import { checkOpportunityEligibilityForSurvey } from "@/lib/survey-eligibility";
import crypto from "crypto";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.view") ||
    hasPermission(user, "commercial.surveys.view") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view commercial site surveys." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const lifecycle = searchParams.get("lifecycle") || "ALL";
  const caseId = searchParams.get("caseId") || undefined;
  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;

  // Company Isolation (fail closed)
  const companyScope = resolveCompanyScope(user, {
    crossCompanyPermissions: ["commercial.commandCenter.crossCompany"],
    requestedCompanyId: companyId,
  });
  if (companyScope.error) return companyScope.error;
  companyId = companyScope.companyId || undefined;

  // SG / FM Scope Isolation
  if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
    const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
    const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

    if (operationType === "SECURITY_GUARDING" && !userAllowedSG) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Security Guarding operational data." },
        { status: 403 }
      );
    }
    if (operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Facility Management operational data." },
        { status: 403 }
      );
    }

    if (!operationType || operationType === "ALL") {
      if (userAllowedSG && !userAllowedFM) {
        operationType = "SECURITY_GUARDING";
      } else if (!userAllowedSG && userAllowedFM) {
        operationType = "FACILITY_MANAGEMENT";
      }
    }
  }

  try {
    const where: any = {};

    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (lifecycle && lifecycle !== "ALL") where.lifecycle = lifecycle;
    if (caseId) where.caseId = caseId;

    if (search) {
      where.OR = [
        { case: { title: { contains: search } } },
        { case: { prospectClient: { name: { contains: search } } } },
        { prospectiveSite: { name: { contains: search } } },
        { conductedBy: { contains: search } }
      ];
    }

    const surveys = await prisma.preContractSurvey.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            lifecycle: true,
            businessOutcome: true,
            prospectClient: {
              select: { id: true, name: true, crNumber: true }
            }
          }
        },
        prospectiveSite: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            approximateArea: true
          }
        },
        responses: {
          select: { id: true, elementCode: true, textValue: true, numericValue: true, booleanValue: true, notes: true }
        },
        siteConditions: true
      },
      orderBy: { createdAt: "desc" }
    });

    const summaryStats = {
      totalSurveys: surveys.length,
      draftCount: surveys.filter((s) => s.lifecycle === "DRAFT").length,
      inWorkflowCount: surveys.filter((s) => s.lifecycle === "IN_WORKFLOW").length,
      approvedCount: surveys.filter((s) => s.lifecycle === "COMPLETED").length,
      cancelledCount: surveys.filter((s) => s.lifecycle === "CANCELLED").length
    };

    return NextResponse.json({
      surveys,
      summaryStats,
      totalCount: surveys.length
    });
  } catch (error: any) {
    console.error("COMMERCIAL SITE SURVEYS GET ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch commercial site surveys." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.manage") ||
    hasPermission(user, "commercial.surveys.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to create commercial site surveys." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      caseId,
      prospectiveSiteId,
      siteName,
      siteAddress,
      latitude,
      longitude,
      approximateArea,
      operationType,
      conductedBy,
      conductedAt
    } = body;

    if (!caseId) {
      return NextResponse.json({ error: "Opportunity Case ID (caseId) is required." }, { status: 400 });
    }

    if (!prospectiveSiteId && (!siteName || !String(siteName).trim())) {
      return NextResponse.json({ error: "Prospective Site Name is required." }, { status: 400 });
    }
    if (!prospectiveSiteId && (!siteAddress || !String(siteAddress).trim())) {
      return NextResponse.json({ error: "Site Address is required." }, { status: 400 });
    }

    const opportunityCase = await prisma.preContractCase.findUnique({
      where: { id: caseId },
      include: { prospectClient: true }
    });

    if (!opportunityCase) {
      return NextResponse.json({ error: "Commercial opportunity case not found." }, { status: 404 });
    }

    // Company Boundary Check (fail closed; prevents cross-company probing or survey creation)
    const companyErr = checkRecordCompanyAccess(user, opportunityCase.companyId, {
      crossCompanyPermissions: ["commercial.commandCenter.crossCompany"],
    });
    if (companyErr) return companyErr;

    // Issue #6 Opportunity Eligibility Rule: Only approved (COMPLETED, non-LOST) opportunities are eligible
    const eligibility = checkOpportunityEligibilityForSurvey(opportunityCase);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.errorMessage },
        { status: 400 }
      );
    }

    const effectiveCompanyId = user?.companyId && !isAdminUser(user) ? user.companyId : opportunityCase.companyId || null;
    const effectiveOpType = operationType || opportunityCase.operationType || "SECURITY_GUARDING";

    // SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (effectiveOpType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (effectiveOpType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    // Prospective Site Handling: Reuse existing site if provided or existing by name/address to prevent duplicate prospective site records
    let siteRecordId = prospectiveSiteId || null;

    if (!siteRecordId && siteName) {
      const normalizedSiteName = siteName.trim().replace(/\s+/g, " ");
      const existingSite = await prisma.preContractProspectiveSite.findFirst({
        where: {
          name: normalizedSiteName,
          ...(effectiveCompanyId && { companyId: effectiveCompanyId })
        }
      });

      if (existingSite) {
        siteRecordId = existingSite.id;
      } else {
        const newSite = await prisma.preContractProspectiveSite.create({
          data: {
            name: normalizedSiteName,
            address: siteAddress?.trim() || null,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            approximateArea: approximateArea ? parseFloat(approximateArea) : null,
            companyId: effectiveCompanyId,
            operationType: effectiveOpType
          }
        });
        siteRecordId = newSite.id;
      }
    }

    // Resolve or generate active SurveyTemplate and SurveyTemplateVersion
    let activeVersion: any = await prisma.surveyTemplateVersion.findFirst({
      where: {
        status: "ACTIVE",
        template: {
          isActive: true,
          OR: [{ operationType: effectiveOpType }, { operationType: "ALL" }, { operationType: null }]
        }
      },
      include: {
        template: true,
        sections: {
          include: {
            elements: {
              include: { options: true }
            }
          }
        }
      },
      orderBy: { effectiveFrom: "desc" }
    });

    // If no active template exists in DB yet, create a default template configuration for CL-2
    if (!activeVersion) {
      const defaultTemplate = await prisma.surveyTemplate.create({
        data: {
          code: `TMPL-${effectiveOpType}`,
          name: `${effectiveOpType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"} Physical Site Assessment`,
          description: "Standard Pre-Contract Site Survey Template",
          companyId: effectiveCompanyId,
          operationType: effectiveOpType,
          versions: {
            create: [
              {
                versionNumber: 1,
                status: "ACTIVE",
                effectiveFrom: new Date(),
                createdBy: user?.id || "SYSTEM",
                sections: {
                  create: [
                    {
                      code: "SEC_SITE_PROFILE",
                      name: "Site Profile & Access Constraints",
                      displayOrder: 1,
                      elements: {
                        create: [
                          {
                            code: "ELEM_POST_COUNT",
                            name: "Required Guard / Operator Posts",
                            description: "Number of continuous posts required on site",
                            responseType: "INTEGER",
                            displayOrder: 1,
                            isRequired: true
                          },
                          {
                            code: "ELEM_SHIFT_PATTERN",
                            name: "Shift Coverage Requirement",
                            description: "Coverage schedule (e.g., 24/7 12-hour shifts)",
                            responseType: "SHORT_TEXT",
                            displayOrder: 2,
                            isRequired: true
                          },
                          {
                            code: "ELEM_SUPERVISION",
                            name: "Supervision Requirement",
                            description: "Dedicated supervisor needed on-site",
                            responseType: "BOOLEAN",
                            displayOrder: 3
                          }
                        ]
                      }
                    },
                    {
                      code: "SEC_RISK_WELFARE",
                      name: "Hazard, Welfare & Logistic Observations",
                      displayOrder: 2,
                      elements: {
                        create: [
                          {
                            code: "ELEM_WELFARE_FACILITIES",
                            name: "Client Provided Welfare Facilities",
                            description: "Rest areas, toilets, and drinking water availability",
                            responseType: "LONG_TEXT",
                            displayOrder: 1
                          },
                          {
                            code: "ELEM_UNIFORM_PPE",
                            name: "Special Uniform & PPE Requirements",
                            description: "High-vis, steel toe, hard hat, or specialized gear",
                            responseType: "LONG_TEXT",
                            displayOrder: 2
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        include: {
          versions: {
            include: {
              template: true,
              sections: {
                include: { elements: { include: { options: true } } }
              }
            }
          }
        }
      });
      activeVersion = defaultTemplate.versions[0];
    }

    if (!activeVersion) {
      return NextResponse.json({ error: "Failed to resolve active survey template version." }, { status: 500 });
    }

    // DEF-099: Prevent duplicate independent surveys for the same opportunity case and prospective site
    // Blocks DRAFT, IN_WORKFLOW, and COMPLETED (approved) surveys while allowing CANCELLED / SUPERSEDED.
    // Locks the parent PreContractCase row FOR UPDATE inside the transaction to serialize concurrent creation requests per caseId.
    const snapshotContent = JSON.stringify(activeVersion);
    const checksum = crypto.createHash("sha256").update(snapshotContent).digest("hex");

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM PreContractCase WHERE id = ${caseId} FOR UPDATE`;

      const existingSurvey = await findConflictingActiveSurvey(tx, {
        caseId,
        prospectiveSiteId: siteRecordId
      });
      if (existingSurvey) {
        return { duplicate: existingSurvey } as const;
      }

      const createdSurvey = await tx.preContractSurvey.create({
        data: {
          companyId: effectiveCompanyId,
          operationType: effectiveOpType,
          caseId,
          prospectiveSiteId: siteRecordId,
          lifecycle: "DRAFT",
          conductedBy: conductedBy?.trim() || user?.name || user?.email || "SURVEYOR",
          conductedAt: conductedAt ? new Date(conductedAt) : new Date()
        },
        include: {
          case: {
            select: { id: true, title: true, prospectClient: { select: { id: true, name: true } } }
          },
          prospectiveSite: true
        }
      });

      await tx.surveyConfigurationSnapshot.create({
        data: {
          surveyId: createdSurvey.id,
          templateVersionId: activeVersion.id,
          snapshotJson: snapshotContent,
          checksum
        }
      });

      return { survey: createdSurvey } as const;
    });

    if ("duplicate" in txResult && txResult.duplicate) {
      return NextResponse.json(
        {
          error: formatDuplicateSurveyMessage(txResult.duplicate.lifecycle),
          existingSurveyId: txResult.duplicate.id,
          existingLifecycle: txResult.duplicate.lifecycle
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ survey: txResult.survey }, { status: 201 });
  } catch (error: any) {
    console.error("COMMERCIAL SITE SURVEYS POST ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create commercial site survey." },
      { status: 500 }
    );
  }
}
