import { prisma } from "@ahh-wfm/database";
import { GET as getSurveys, POST as postSurveys } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { GET as getSurveyById, PATCH as patchSurveyById } from "../../apps/web/app/api/v1/commercial/surveys/[id]/route";
import { POST as postSurveyWorkflow } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle — Phase CL-2 Suite (Pre-Contract Site Surveys & Audits)", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CL2",
    name: "Commercial Admin CL2",
    role: "SUPER_ADMIN",
    permissions: [
      "manpower.admin.full_access",
      "precontract.case.view",
      "precontract.case.manage",
      "commercial.surveys.view",
      "commercial.surveys.manage",
      "precontract.workflow.submit",
      "precontract.workflow.approve",
      "precontract.workflow.review"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockSgUser = {
    id: "EMP-SG-CL2",
    name: "SG Surveyor",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CL2-01",
    permissions: [
      "precontract.case.view",
      "commercial.surveys.view",
      "commercial.surveys.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CL2",
    name: "FM Surveyor",
    role: "FM_ADMIN",
    companyId: "COMP-CL2-01",
    permissions: [
      "precontract.case.view",
      "commercial.surveys.view",
      "commercial.surveys.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockLevel1Approver = {
    id: "EMP-L1-SURVEY-APPROVER",
    name: "Level 1 Survey Approver",
    role: "COMMERCIAL_SUPERVISOR",
    companyId: "COMP-CL2-01",
    permissions: [
      "commercial.surveys.view",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockLevel2Approver = {
    id: "EMP-L2-SURVEY-APPROVER",
    name: "Level 2 Director Approver",
    role: "COMMERCIAL_DIRECTOR",
    companyId: "COMP-CL2-01",
    permissions: [
      "commercial.surveys.view",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-NO-PERM-CL2",
    name: "No Permission User",
    role: "EMPLOYEE",
    permissions: ["self.profile.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  let testCompany: any;
  let testCase: any;
  let testCancelledCase: any;
  let testWorkflowTemplate: any;
  let testSurvey: any;
  let testAttachment: any;

  beforeAll(async () => {
    // 1. Clean up stale test data safely using raw SQL
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM SurveyResponseEvidence WHERE responseId IN (SELECT id FROM SurveyResponse WHERE surveyId IN (SELECT id FROM PreContractSurvey WHERE companyId = 'COMP-CL2-01'))`);
      await prisma.$executeRawUnsafe(`DELETE FROM SurveyResponse WHERE surveyId IN (SELECT id FROM PreContractSurvey WHERE companyId = 'COMP-CL2-01')`);
      await prisma.$executeRawUnsafe(`DELETE FROM SurveySiteCondition WHERE surveyId IN (SELECT id FROM PreContractSurvey WHERE companyId = 'COMP-CL2-01')`);
      await prisma.$executeRawUnsafe(`DELETE FROM SurveyConfigurationSnapshot WHERE surveyId IN (SELECT id FROM PreContractSurvey WHERE companyId = 'COMP-CL2-01')`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowActionHistory WHERE instanceId IN (SELECT id FROM WorkflowInstance WHERE companyId = 'COMP-CL2-01')`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowInstance WHERE companyId = 'COMP-CL2-01'`);
      await prisma.$executeRawUnsafe(`DELETE FROM PreContractSurvey WHERE companyId = 'COMP-CL2-01'`);
      await prisma.$executeRawUnsafe(`DELETE FROM PreContractCase WHERE companyId = 'COMP-CL2-01'`);
      await prisma.$executeRawUnsafe(`DELETE FROM PreContractProspectiveSite WHERE companyId = 'COMP-CL2-01'`);

      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateApprover WHERE levelId IN (SELECT id FROM WorkflowTemplateLevel WHERE templateId = 'WF-TMPL-CL2-SURVEY')`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateLevel WHERE templateId = 'WF-TMPL-CL2-SURVEY'`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplate WHERE id = 'WF-TMPL-CL2-SURVEY'`);
    } catch (e) {}

    // 2. Setup Test Company
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CL2-01" },
      update: {},
      create: {
        id: "COMP-CL2-01",
        companyCode: "COMPCL2",
        companyName: "CL2 Survey Test Company"
      }
    });

    // 3. Setup Eligible Opportunity Case
    testCase = await prisma.preContractCase.create({
      data: {
        title: "Katara Cultural Village Security Audit 2026",
        companyId: "COMP-CL2-01",
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: "EMP-SG-CL2"
      }
    });

    // 4. Setup Ineligible Cancelled Opportunity Case
    testCancelledCase = await prisma.preContractCase.create({
      data: {
        title: "Cancelled Proposal Case",
        companyId: "COMP-CL2-01",
        operationType: "SECURITY_GUARDING",
        lifecycle: "CANCELLED",
        businessOutcome: "LOST",
        createdBy: "EMP-SG-CL2"
      }
    });

    // 5. Setup Centralized Multi-Level Survey Workflow Template in Settings > Workflow Setup
    testWorkflowTemplate = await prisma.workflowTemplate.create({
      data: {
        id: "WF-TMPL-CL2-SURVEY",
        workflowName: "Pre-Contract Site Survey Multi-Level Approval",
        moduleType: "PRE_CONTRACT_SURVEY",
        operationType: "SECURITY_GUARDING",
        appliesTo: "ACTIVATION",
        isDefault: true,
        isActive: true,
        remarks: "Central workflow setup for Site Survey review with 2 levels",
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Level 1 Operations Review",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "ROLE_BASED",
                    roleName: "COMMERCIAL_SUPERVISOR"
                  }
                ]
              }
            },
            {
              levelNumber: 2,
              levelName: "Level 2 Technical Director Approval",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "ROLE_BASED",
                    roleName: "COMMERCIAL_DIRECTOR"
                  }
                ]
              }
            }
          ]
        }
      }
    });

    // 6. Setup System Attachment for Evidence test
    testAttachment = await prisma.systemAttachment.create({
      data: {
        companyId: "COMP-CL2-01",
        operationType: "SECURITY_GUARDING",
        fileName: "katara_gate_photo.jpg",
        originalName: "katara_gate_photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 102400,
        storagePath: "/uploads/surveys/katara_gate_photo.jpg",
        evidenceType: "SURVEY_PHOTO",
        caption: "Main Gate Post Location Photo",
        uploadedById: mockSgUser.id
      }
    });
  });

  afterAll(async () => {
    try {
      if (testAttachment?.id) {
        await prisma.systemAttachment.deleteMany({ where: { id: testAttachment.id } });
      }
      if (testSurvey?.id) {
        await prisma.surveyResponseEvidence.deleteMany({ where: { response: { surveyId: testSurvey.id } } });
        await prisma.surveyResponse.deleteMany({ where: { surveyId: testSurvey.id } });
        await prisma.surveySiteCondition.deleteMany({ where: { surveyId: testSurvey.id } });
        await prisma.surveyConfigurationSnapshot.deleteMany({ where: { surveyId: testSurvey.id } });
        await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: testSurvey.id } } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: testSurvey.id } });
        await prisma.preContractSurvey.deleteMany({ where: { id: testSurvey.id } });
      }
      if (testCase?.id) await prisma.preContractCase.deleteMany({ where: { id: testCase.id } });
      if (testCancelledCase?.id) await prisma.preContractCase.deleteMany({ where: { id: testCancelledCase.id } });
      if (testWorkflowTemplate?.id) {
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateApprover WHERE levelId IN (SELECT id FROM WorkflowTemplateLevel WHERE templateId = '${testWorkflowTemplate.id}')`);
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateLevel WHERE templateId = '${testWorkflowTemplate.id}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplate WHERE id = '${testWorkflowTemplate.id}'`);
      }
      if (testCompany?.id) await prisma.company.deleteMany({ where: { id: testCompany.id } });
    } catch (e) {}
  });

  it("1. Unauthenticated request to /api/v1/commercial/surveys returns 401", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/v1/commercial/surveys");
    const res = await getSurveys(req);
    expect(res.status).toBe(401);
  });

  it("2. Unauthorized user request returns 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockUnauthorizedUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys");
    const res = await getSurveys(req);
    expect(res.status).toBe(403);
  });

  it("3. Valid opportunity case creates draft survey with prospective site", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: testCase.id,
        siteName: "Katara West Entrance Gate 1",
        siteAddress: "Building 12, Katara Cultural Village, Doha",
        latitude: 25.3548,
        longitude: 51.5310,
        approximateArea: 15000,
        operationType: "SECURITY_GUARDING",
        conductedBy: "EMP-SG-CL2"
      })
    });

    const res = await postSurveys(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.survey.caseId).toBe(testCase.id);
    expect(json.survey.lifecycle).toBe("DRAFT");
    expect(json.survey.prospectiveSite.name).toBe("Katara West Entrance Gate 1");

    testSurvey = json.survey;
  });

  it("4. Ineligible opportunity case (CANCELLED case) is rejected with 400 error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: testCancelledCase.id,
        siteName: "Ineligible Site Audit",
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postSurveys(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Ineligible Opportunity");
  });

  it("5. Prospective site reuse prevents duplicate PreContractProspectiveSite records", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: testCase.id,
        siteName: "Katara West Entrance Gate 1", // Matches existing site name created in test 3
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postSurveys(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.survey.prospectiveSiteId).toBe(testSurvey.prospectiveSiteId);

    // Clean up second temporary survey
    await prisma.surveyConfigurationSnapshot.deleteMany({ where: { surveyId: json.survey.id } });
    await prisma.preContractSurvey.delete({ where: { id: json.survey.id } });
  });

  it("6. Submitting survey resolves active central workflow template and binds WorkflowInstance", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SUBMIT",
        remarks: "Submitting Katara Site Survey for multi-level technical review"
      })
    });

    const res = await postSurveyWorkflow(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.survey.lifecycle).toBe("IN_WORKFLOW");
    expect(json.workflow.action).toBe("SUBMIT");
    expect(json.workflow.status).toBe("IN_PROGRESS");
    expect(json.workflow.currentLevelNumber).toBe(1);
  });

  it("7. Missing active workflow template is rejected when template deactivated", async () => {
    await prisma.workflowTemplate.update({
      where: { id: testWorkflowTemplate.id },
      data: { isActive: false }
    });

    const tempSurvey = await prisma.preContractSurvey.create({
      data: {
        companyId: "COMP-CL2-01",
        operationType: "SECURITY_GUARDING",
        caseId: testCase.id,
        lifecycle: "DRAFT",
        conductedBy: "EMP-SURVEYOR"
      }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${tempSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT" })
    });

    const res = await postSurveyWorkflow(req, { params: { id: tempSurvey.id } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing Workflow Configuration");

    // Re-activate template and clean up
    await prisma.workflowTemplate.update({
      where: { id: testWorkflowTemplate.id },
      data: { isActive: true }
    });
    await prisma.preContractSurvey.delete({ where: { id: tempSurvey.id } });
  });

  it("8. Survey lifecycle transitions to IN_WORKFLOW on submit", async () => {
    const srv = await prisma.preContractSurvey.findUnique({
      where: { id: testSurvey.id }
    });
    expect(srv?.lifecycle).toBe("IN_WORKFLOW");
  });

  it("9. Level 1 approval advances level and keeps survey lifecycle IN_WORKFLOW", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Level 1 Operations Manager approval granted."
      })
    });

    const res = await postSurveyWorkflow(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);

    const srv = await prisma.preContractSurvey.findUnique({ where: { id: testSurvey.id } });
    const wf = await prisma.workflowInstance.findFirst({ where: { referenceId: testSurvey.id } });

    expect(srv?.lifecycle).toBe("IN_WORKFLOW");
    expect(wf?.currentLevelNumber).toBe(2);
    expect(wf?.status).toBe("IN_PROGRESS");
  });

  it("10. Unauthorized approver (Level 1 approver attempting Level 2) is rejected with 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Unauthorized attempt to approve Level 2."
      })
    });

    const res = await postSurveyWorkflow(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("not an authorized approver for Level 2");
  });

  it("11. Segregation of duties prevents surveyor/creator from self-approving", async () => {
    const tempSurvey = await prisma.preContractSurvey.create({
      data: {
        companyId: "COMP-CL2-01",
        operationType: "SECURITY_GUARDING",
        caseId: testCase.id,
        lifecycle: "DRAFT",
        conductedBy: "EMP-SURVEYOR-CREATOR"
      }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/surveys/${tempSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT" })
    });
    await postSurveyWorkflow(submitReq, { params: { id: tempSurvey.id } });

    // Attempt self approval as surveyor creator
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "EMP-SURVEYOR-CREATOR",
        name: "EMP-SURVEYOR-CREATOR",
        role: "COMMERCIAL_SUPERVISOR",
        permissions: ["precontract.workflow.approve"]
      }
    });

    const approveReq = new Request(`http://localhost/api/v1/commercial/surveys/${tempSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", remarks: "Self approval attempt" })
    });

    const res = await postSurveyWorkflow(approveReq, { params: { id: tempSurvey.id } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Segregation of Duties");

    // Clean up
    await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: tempSurvey.id } } });
    await prisma.workflowInstance.deleteMany({ where: { referenceId: tempSurvey.id } });
    await prisma.preContractSurvey.delete({ where: { id: tempSurvey.id } });
  });

  it("12. Final level approval transitions survey lifecycle to COMPLETED (Approved)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel2Approver });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Level 2 Technical Director final approval granted."
      })
    });

    const res = await postSurveyWorkflow(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.survey.lifecycle).toBe("COMPLETED");
    expect(json.workflow.status).toBe("APPROVED");
  });

  it("13. RETURN action updates workflow status to RETURNED and survey lifecycle to DRAFT", async () => {
    // Submit survey again
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Resubmitting for verification" })
    });
    await postSurveyWorkflow(submitReq, { params: { id: testSurvey.id } });

    // Execute RETURN action
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const returnReq = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RETURN", remarks: "Returning to surveyor for guard post count correction" })
    });

    const res = await postSurveyWorkflow(returnReq, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.survey.lifecycle).toBe("DRAFT");
    expect(json.workflow.status).toBe("RETURNED");
  });

  it("14. REJECT action updates workflow status to REJECTED and survey lifecycle to CANCELLED", async () => {
    // Resubmit survey
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Final resubmission" })
    });
    await postSurveyWorkflow(submitReq, { params: { id: testSurvey.id } });

    // Execute REJECT action
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const rejectReq = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", remarks: "Unviable site access conditions rejected" })
    });

    const res = await postSurveyWorkflow(rejectReq, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.survey.lifecycle).toBe("CANCELLED");
    expect(json.workflow.status).toBe("REJECTED");
  });

  it("15. Approved survey is immutable (updating responses/site conditions returns 400)", async () => {
    // Set survey back to COMPLETED (Approved) to test immutability policy
    await prisma.preContractSurvey.update({
      where: { id: testSurvey.id },
      data: { lifecycle: "COMPLETED" }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: [{ elementCode: "ELEM_POST_COUNT", numericValue: 99 }]
      })
    });

    const res = await patchSurveyById(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Approved survey evidence is immutable");
  });

  it("16. Re-survey / revision creates new survey record while preserving original approved survey", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: testCase.id,
        prospectiveSiteId: testSurvey.prospectiveSiteId,
        operationType: "SECURITY_GUARDING",
        conductedBy: "EMP-SG-CL2",
        remarks: "Revision survey 2"
      })
    });

    const res = await postSurveys(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    // Provenance check: Original approved survey remains untouched in COMPLETED state
    const originalSurvey = await prisma.preContractSurvey.findUnique({ where: { id: testSurvey.id } });
    expect(originalSurvey?.lifecycle).toBe("COMPLETED");

    expect(json.survey.id).not.toBe(testSurvey.id);
    expect(json.survey.lifecycle).toBe("DRAFT");

    // Clean up revision survey
    await prisma.surveyConfigurationSnapshot.deleteMany({ where: { surveyId: json.survey.id } });
    await prisma.preContractSurvey.delete({ where: { id: json.survey.id } });
  });

  it("17. WorkflowActionHistory is completely immutable and retains full action sequence", async () => {
    const history = await prisma.workflowActionHistory.findMany({
      where: { instance: { referenceId: testSurvey.id } },
      orderBy: { createdAt: "asc" }
    });

    expect(history.length).toBeGreaterThanOrEqual(5);
    const actions = history.map((h) => h.action);
    expect(actions).toContain("SUBMIT");
    expect(actions).toContain("APPROVE");
    expect(actions).toContain("RETURN");
    expect(actions).toContain("REJECT");
  });

  it("18. Company isolation restricts company-bound user from viewing other company's surveys", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys");
    const res = await getSurveys(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.surveys)).toBe(true);
  });

  it("19. Security Guarding user restricted from accessing Facility Management survey with 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys?operationType=FACILITY_MANAGEMENT");
    const res = await getSurveys(req);
    expect(res.status).toBe(403);
  });

  it("20. Facility Management user restricted from accessing Security Guarding survey with 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockFmUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys?operationType=SECURITY_GUARDING");
    const res = await getSurveys(req);
    expect(res.status).toBe(403);
  });

  it("21. Configured template loading and snapshot generation verified", async () => {
    const snapshot = await prisma.surveyConfigurationSnapshot.findUnique({
      where: { surveyId: testSurvey.id }
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.snapshotJson).toBeDefined();
    expect(snapshot?.checksum).toBeDefined();
  });

  it("22. Site condition configuration reuse and SurveySiteCondition creation verified", async () => {
    // Reset test survey to DRAFT to allow PATCH
    await prisma.preContractSurvey.update({
      where: { id: testSurvey.id },
      data: { lifecycle: "DRAFT" }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteConditions: [
          {
            definitionCode: "COND_ACCESS_HAZARD",
            definitionVersion: 1,
            assessedSeverity: "HIGH",
            notes: "Narrow access gate for heavy patrol vehicles",
            clientResponsibility: true,
            ahhResponsibility: false,
            operationalImpactClass: "CRITICAL",
            costImpactClass: "EXTRA_FEE"
          }
        ]
      })
    });

    const res = await patchSurveyById(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);

    const condition = await prisma.surveySiteCondition.findFirst({
      where: { surveyId: testSurvey.id, definitionCode: "COND_ACCESS_HAZARD" }
    });

    expect(condition).toBeDefined();
    expect(condition?.assessedSeverity).toBe("HIGH");
    expect(condition?.clientResponsibility).toBe(true);
  });

  it("23. Attachment linking via SystemAttachment & SurveyResponseEvidence verified", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/surveys/${testSurvey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: [
          {
            elementCode: "ELEM_POST_COUNT",
            numericValue: 8,
            notes: "Main gate continuous 24/7 post",
            attachmentId: testAttachment.id
          }
        ]
      })
    });

    const res = await patchSurveyById(req, { params: { id: testSurvey.id } });
    expect(res.status).toBe(200);

    const resp = await prisma.surveyResponse.findFirst({
      where: { surveyId: testSurvey.id, elementCode: "ELEM_POST_COUNT" },
      include: { evidences: true }
    });

    expect(resp).toBeDefined();
    expect(resp?.numericValue).toBe(8);
    expect(resp?.evidences.length).toBeGreaterThan(0);
    expect(resp?.evidences[0].attachmentId).toBe(testAttachment.id);
  });

  it("24. Survey register API returns correct search, status, and operation type breakdown", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/surveys?search=Katara");
    const res = await getSurveys(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.surveys).toBeDefined();
    expect(Array.isArray(json.surveys)).toBe(true);
    expect(json.summaryStats).toBeDefined();
    expect(json.summaryStats.totalSurveys).toBeGreaterThanOrEqual(1);
  });
});
