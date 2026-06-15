import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

function parseDateStr(fieldLabel: string, val: any, errors: string[]): Date | undefined {
  if (val === undefined || val === null || String(val).trim() === "") return undefined;
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) {
    errors.push(`Invalid date format for ${fieldLabel}: ${val}`);
    return undefined;
  }
  return parsed;
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any)?.id || "admin-system";

  try {
    const body = await request.json();
    const { rows, fileName, updateExisting } = body;
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array in payload" }, { status: 400 });
    }

    const companies = await mockDb.getCompanies();
    const depts = await mockDb.getDepartments();
    const existingEmployees = await mockDb.getEmployees();
    const projects = await mockDb.getProjects();
    const sites = await mockDb.getProjectSites();
    const categories = await mockDb.getBlueCollarPositionCategories();

    let importedCount = 0;
    let failedCount = 0;
    const failures: { row: number; errors: string[] }[] = [];

    // Register starting job in database
    const job = await mockDb.createEmployeeBulkUploadJob({
      fileName: fileName || "import.csv",
      status: "PROCESSING",
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      importedRows: 0,
      failedRows: 0,
      uploadedById: userId
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const errors: string[] = [];

      if (!row.employeeId || !row.fullName || !row.email || !row.department || !row.role) {
        errors.push("Missing core required parameters");
      }

      if (errors.length > 0) {
        failedCount++;
        failures.push({ row: rowNum, errors });
        continue;
      }

      try {
        // 1. Resolve Company
        let companyId: string | undefined = undefined;
        const matchedEmp = existingEmployees.find(e => e.id === row.employeeId);
        const isNewEmployee = !matchedEmp;
        const empStatus = row.employmentStatus || (matchedEmp ? matchedEmp.employmentStatus : "ACTIVE");

        if (row.companyCode) {
          const matchComp = companies.find(c => c.companyCode.toLowerCase() === row.companyCode.toLowerCase());
          if (matchComp) {
            companyId = matchComp.id;
          } else {
            errors.push(`Company Code '${row.companyCode}' not found in Master Data`);
          }
        } else {
          // Company required for new active employees
          if (isNewEmployee && empStatus === "ACTIVE") {
            errors.push("Company Code is required for active employees");
          } else if (matchedEmp && matchedEmp.companyId) {
            companyId = matchedEmp.companyId; // keep existing if not provided
          }
        }

        // Date Parsing & Validation
        const dateOfJoining = parseDateStr("joiningDate/dateOfJoining", row.dateOfJoining || row.joiningDate, errors);
        const qidExpiryDate = parseDateStr("qidExpiryDate", row.qidExpiryDate, errors);
        const passportIssueDate = parseDateStr("passportIssueDate", row.passportIssueDate, errors);
        const passportExpiryDate = parseDateStr("passportExpiryDate", row.passportExpiryDate, errors);

        // Business logic date rules
        const finalJoiningDate = dateOfJoining || (matchedEmp ? (matchedEmp.dateOfJoining ? new Date(matchedEmp.dateOfJoining) : undefined) : undefined);
        const finalQidExpiry = qidExpiryDate || (matchedEmp ? (matchedEmp.qidExpiryDate ? new Date(matchedEmp.qidExpiryDate) : undefined) : undefined);
        if (finalJoiningDate && finalQidExpiry && finalQidExpiry < finalJoiningDate) {
          errors.push("Qatar ID expiry date cannot be before date of joining");
        }

        const finalPassIssue = passportIssueDate || (matchedEmp ? (matchedEmp.passportIssueDate ? new Date(matchedEmp.passportIssueDate) : undefined) : undefined);
        const finalPassExpiry = passportExpiryDate || (matchedEmp ? (matchedEmp.passportExpiryDate ? new Date(matchedEmp.passportExpiryDate) : undefined) : undefined);
        if (finalPassIssue && finalPassExpiry && finalPassExpiry < finalPassIssue) {
          errors.push("Passport expiry date cannot be before issue date");
        }

        // Document values (cleaned)
        const qidNumber = row.qidNumber ? String(row.qidNumber).trim() : undefined;
        const passportNumber = row.passportNumber ? String(row.passportNumber).trim().toUpperCase() : undefined;

        // Duplicate QID check
        if (qidNumber) {
          const dupQid = existingEmployees.find(e => e.id !== row.employeeId && e.qidNumber && e.qidNumber.trim() === qidNumber);
          if (dupQid) {
            errors.push(`Qatar ID '${qidNumber}' is already assigned to employee ${dupQid.name} (${dupQid.id})`);
          }
        }

        // Duplicate Passport check
        if (passportNumber) {
          const dupPass = existingEmployees.find(e => e.id !== row.employeeId && e.passportNumber && e.passportNumber.trim().toUpperCase() === passportNumber);
          if (dupPass) {
            errors.push(`Passport '${passportNumber}' is already assigned to employee ${dupPass.name} (${dupPass.id})`);
          }
        }

        if (errors.length > 0) {
          failedCount++;
          failures.push({ row: rowNum, errors });
          continue;
        }

        // Resolve/Create department if needed
        let deptId = "";
        const matchedDept = depts.find(d => d.name.toLowerCase() === row.department.toLowerCase());
        if (matchedDept) {
          deptId = matchedDept.id;
        } else {
          // Create new department
          const newDept = await mockDb.createDepartment(row.department);
          depts.push(newDept);
          deptId = newDept.id;
        }

        // Resolve default project
        let defaultProjectId = undefined;
        if (row.defaultProjectCode) {
          const matchProj = projects.find(p => p.projectCode.toLowerCase() === row.defaultProjectCode.toLowerCase() || p.id.toLowerCase() === row.defaultProjectCode.toLowerCase());
          if (matchProj) defaultProjectId = matchProj.id;
        }

        // Resolve default site
        let defaultSiteId = undefined;
        if (row.defaultSiteCode) {
          const matchSite = sites.find(s => s.siteCode.toLowerCase() === row.defaultSiteCode.toLowerCase() || s.id.toLowerCase() === row.defaultSiteCode.toLowerCase());
          if (matchSite) defaultSiteId = matchSite.id;
        }

        // Resolve position category
        let positionCategoryId = undefined;
        if (row.positionCategory) {
          const matchCat = categories.find(c => c.code.toLowerCase() === row.positionCategory.toLowerCase() || c.name.toLowerCase() === row.positionCategory.toLowerCase());
          if (matchCat) positionCategoryId = matchCat.id;
        }

        if (matchedEmp) {
          if (updateExisting) {
            // Update employee
            await mockDb.updateEmployee(matchedEmp.id, {
              name: row.fullName,
              email: row.email,
              phone: row.phone || matchedEmp.phone,
              department: row.department,
              departmentId: deptId,
              role: row.role.toUpperCase(),
              employmentStatus: row.employmentStatus || matchedEmp.employmentStatus,
              dutyStatus: row.dutyStatus || matchedEmp.dutyStatus,
              workerCategory: row.workerCategory || matchedEmp.workerCategory,
              isActive: row.employmentStatus ? (row.employmentStatus === "ACTIVE") : matchedEmp.isActive,
              positionCategoryId: positionCategoryId || matchedEmp.positionCategoryId,
              defaultProjectId: defaultProjectId || matchedEmp.defaultProjectId,
              defaultSiteId: defaultSiteId || matchedEmp.defaultSiteId,
              
              // New fields
              companyId: companyId || matchedEmp.companyId,
              qidNumber: qidNumber || matchedEmp.qidNumber,
              qidExpiryDate: qidExpiryDate || matchedEmp.qidExpiryDate,
              passportNumber: passportNumber || matchedEmp.passportNumber,
              passportIssueDate: passportIssueDate || matchedEmp.passportIssueDate,
              passportExpiryDate: passportExpiryDate || matchedEmp.passportExpiryDate,
              passportIssuingCountry: row.passportIssuingCountry || matchedEmp.passportIssuingCountry,
              dateOfJoining: dateOfJoining || matchedEmp.dateOfJoining,
              sponsor: row.sponsor || matchedEmp.sponsor
            });
            importedCount++;
          } else {
            failedCount++;
            failures.push({ row: rowNum, errors: [`Employee ID ${row.employeeId} already exists.`] });
          }
        } else {
          // Create employee
          await mockDb.createEmployee({
            id: row.employeeId,
            name: row.fullName,
            email: row.email,
            phone: row.phone || undefined,
            department: row.department,
            departmentId: deptId,
            role: row.role.toUpperCase(),
            status: row.dutyStatus || "Offline",
            isActive: row.employmentStatus ? (row.employmentStatus === "ACTIVE") : true,
            employmentStatus: row.employmentStatus || "ACTIVE",
            dutyStatus: row.dutyStatus || "OFF_DUTY",
            workerCategory: row.workerCategory || "WHITE_COLLAR",
            positionCategoryId: positionCategoryId || undefined,
            defaultProjectId: defaultProjectId || undefined,
            defaultSiteId: defaultSiteId || undefined,

            // New fields
            companyId: companyId || undefined,
            qidNumber: qidNumber || undefined,
            qidExpiryDate: qidExpiryDate || undefined,
            passportNumber: passportNumber || undefined,
            passportIssueDate: passportIssueDate || undefined,
            passportExpiryDate: passportExpiryDate || undefined,
            passportIssuingCountry: row.passportIssuingCountry || undefined,
            dateOfJoining: dateOfJoining || undefined,
            sponsor: row.sponsor || undefined
          });
          importedCount++;
        }
      } catch (err: any) {
        failedCount++;
        failures.push({ row: rowNum, errors: [err.message || "Failed to persist employee record."] });
      }
    }

    // Update bulk upload job status
    const isCompletedSuccess = failedCount === 0;
    await mockDb.updateEmployeeBulkUploadJob(job.id, {
      status: isCompletedSuccess ? "COMPLETED" : "FAILED",
      importedRows: importedCount,
      failedRows: failedCount,
      completedAt: new Date().toISOString(),
      errorMessage: failures.length > 0 ? JSON.stringify(failures) : undefined
    });

    // Create UserActivityLog
    await mockDb.createUserActivityLog({
      userId,
      action: "BULK_UPLOAD_COMPLETED",
      entityType: "EMPLOYEE",
      entityId: job.id,
      beforeJson: undefined,
      afterJson: JSON.stringify({
        fileName: fileName,
        totalRows: rows.length,
        importedCount,
        failedCount
      }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      importedRows: importedCount,
      failedRows: failedCount,
      failures
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to import bulk employee rows" }, { status: 500 });
  }
}
