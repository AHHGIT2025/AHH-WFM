import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

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
  const auth = await checkApiAuth();
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
    const designations = await mockDb.getDesignations();
    const locations = await mockDb.getLocations();
    const existingEmployees = await mockDb.getEmployees();

    let importedCount = 0;
    let updatedCount = 0;
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

      const empCode = row.employeeCode || row.employeeId;
      if (!empCode || !row.fullName || !row.companyCode || !row.department || !row.designation || !row.employeeCategory || !row.operationType || !row.defaultLocation || !row.dateOfJoining) {
        errors.push("Missing core required parameters");
      }

      if (errors.length > 0) {
        failedCount++;
        failures.push({ row: rowNum, errors });
        continue;
      }

      try {
        // Resolve Company
        let companyId = "";
        const matchComp = companies.find(c => c.companyCode.toLowerCase() === row.companyCode.trim().toLowerCase());
        if (matchComp) companyId = matchComp.id;

        // Resolve Designation
        let designationId = "";
        const matchDes = designations.find(d => d.code.toLowerCase() === row.designation.trim().toLowerCase() || d.name.toLowerCase() === row.designation.trim().toLowerCase());
        if (matchDes) designationId = matchDes.id;

        // Resolve Default Location
        let defaultLocationId = "";
        const matchLoc = locations.find(l => l.locationCode.toLowerCase() === row.defaultLocation.trim().toLowerCase() || l.locationName.toLowerCase() === row.defaultLocation.trim().toLowerCase());
        if (matchLoc) defaultLocationId = matchLoc.id;

        // Resolve Department ID (create if missing)
        let departmentId = "";
        const matchedDept = depts.find(d => d.name.toLowerCase() === row.department.trim().toLowerCase());
        if (matchedDept) {
          departmentId = matchedDept.id;
        } else {
          const newDept = await mockDb.createDepartment(row.department.trim(), companyId || undefined);
          depts.push(newDept);
          departmentId = newDept.id;
        }

        // Date Parsing & Validation
        const dateOfJoining = parseDateStr("dateOfJoining", row.dateOfJoining, errors);
        const dateOfBirth = parseDateStr("dateOfBirth", row.dateOfBirth, errors);
        const qidIssueDate = parseDateStr("qidIssueDate", row.qidIssueDate, errors);
        const qidExpiryDate = parseDateStr("qidExpiryDate", row.qidExpiryDate, errors);
        const passportIssueDate = parseDateStr("passportIssueDate", row.passportIssueDate, errors);
        const passportExpiryDate = parseDateStr("passportExpiryDate", row.passportExpiryDate, errors);
        const visaIssueDate = parseDateStr("visaIssueDate", row.visaIssueDate, errors);
        const visaExpiryDate = parseDateStr("visaExpiryDate", row.visaExpiryDate, errors);
        const workPermitExpiryDate = parseDateStr("workPermitExpiryDate", row.workPermitExpiryDate, errors);
        const moiLicenseIssueDate = parseDateStr("moiLicenseIssueDate", row.moiLicenseIssueDate, errors);
        const moiLicenseExpiryDate = parseDateStr("moiLicenseExpiryDate", row.moiLicenseExpiryDate, errors);
        const securityTrainingExpiryDate = parseDateStr("securityTrainingExpiryDate", row.securityTrainingExpiryDate, errors);
        const siteGatePassExpiryDate = parseDateStr("siteGatePassExpiryDate", row.siteGatePassExpiryDate, errors);
        const skillCertificateExpiryDate = parseDateStr("skillCertificateExpiryDate", row.skillCertificateExpiryDate, errors);
        const healthCardExpiryDate = parseDateStr("healthCardExpiryDate", row.healthCardExpiryDate, errors);

        if (errors.length > 0) {
          failedCount++;
          failures.push({ row: rowNum, errors });
          continue;
        }

        const matchedEmp = existingEmployees.find(e => e.id === empCode || (e as any).employeeCode === empCode);
        
        // Define unified profile payload
        const payload: any = {
          id: empCode,
          employeeCode: empCode,
          name: row.fullName,
          email: row.email || `${empCode.toLowerCase()}@alhattab.qa`,
          phone: row.phone || null,
          companyId: companyId || null,
          department: row.department,
          departmentId: departmentId || null,
          designationId: designationId || null,
          role: row.role ? row.role.toUpperCase() : "EMPLOYEE",
          employeeCategory: row.employeeCategory ? row.employeeCategory.toUpperCase() : "WHITE_COLLAR",
          operationType: row.operationType ? row.operationType.toUpperCase() : "WHITE_COLLAR",
          defaultLocationId: defaultLocationId || null,
          dateOfJoining: dateOfJoining || null,
          nationality: row.nationality || null,
          gender: row.gender || null,
          dateOfBirth: dateOfBirth || null,
          qidNumber: row.qidNumber || null,
          qidIssueDate: qidIssueDate || null,
          qidExpiryDate: qidExpiryDate || null,
          passportNumber: row.passportNumber || null,
          passportIssueDate: passportIssueDate || null,
          passportExpiryDate: passportExpiryDate || null,
          passportIssuingCountry: row.passportIssuingCountry || null,
          visaNumber: row.visaNumber || null,
          visaIssueDate: visaIssueDate || null,
          visaExpiryDate: visaExpiryDate || null,
          workPermitNumber: row.workPermitNumber || null,
          workPermitExpiryDate: workPermitExpiryDate || null,
          
          // Security Guarding fields
          moiLicenseNumber: row.moiLicenseNumber || null,
          moiLicenseIssueDate: moiLicenseIssueDate || null,
          moiLicenseExpiryDate: moiLicenseExpiryDate || null,
          securityTrainingCertificateNumber: row.securityTrainingCertificateNumber || null,
          securityTrainingExpiryDate: securityTrainingExpiryDate || null,
          siteGatePassNumber: row.siteGatePassNumber || null,
          siteGatePassExpiryDate: siteGatePassExpiryDate || null,

          // Facility Management fields
          tradeSkill: row.tradeSkill || null,
          skillCertificateNumber: row.skillCertificateNumber || null,
          skillCertificateExpiryDate: skillCertificateExpiryDate || null,
          healthCardNumber: row.healthCardNumber || null,
          healthCardExpiryDate: healthCardExpiryDate || null,

          // Document placeholders
          qidDocumentFile: row.qidDocumentFile || null,
          passportDocumentFile: row.passportDocumentFile || null,
          visaDocumentFile: row.visaDocumentFile || null,
          workPermitDocumentFile: row.workPermitDocumentFile || null,
          moiLicenseDocumentFile: row.moiLicenseDocumentFile || null,
          trainingCertificateFile: row.trainingCertificateFile || null,
          gatePassFile: row.gatePassFile || null,
          healthCardFile: row.healthCardFile || null,

          isActive: true,
          employmentStatus: "ACTIVE",
          status: "Offline",
          dutyStatus: "OFF_DUTY"
        };

        if (isDbConnected()) {
          // 1. Persist/update to Prisma
          const { id, companyId, departmentId, designationId, defaultLocationId, ...employeeData } = payload;
          
          const dbEmployeeData = {
            name: employeeData.name,
            email: employeeData.email,
            phone: employeeData.phone,
            companyId: companyId || undefined,
            departmentId: departmentId || undefined,
            designationId: designationId || undefined,
            defaultLocationId: defaultLocationId || undefined,
            role: employeeData.role,
            employeeCategory: employeeData.employeeCategory,
            operationType: employeeData.operationType,
            dateOfJoining: employeeData.dateOfJoining,
            dateOfBirth: employeeData.dateOfBirth,
            qidNumber: employeeData.qidNumber,
            qidExpiryDate: employeeData.qidExpiryDate,
            passportNumber: employeeData.passportNumber,
            passportExpiryDate: employeeData.passportExpiryDate,
            passportIssueDate: employeeData.passportIssueDate,
            passportIssuingCountry: employeeData.passportIssuingCountry,
            sponsor: row.sponsor || "Al Hattab Holding",
            isActive: true,
            employmentStatus: "ACTIVE",
            status: employeeData.status || "Offline",
            dutyStatus: "OFF_DUTY",
            department: employeeData.department
          };

          if (matchedEmp) {
            if (updateExisting) {
              await prisma.employee.update({
                where: { id: matchedEmp.id },
                data: dbEmployeeData
              });
              updatedCount++;
            } else {
              failedCount++;
              failures.push({ row: rowNum, errors: [`Employee Code ${empCode} already exists.`] });
              continue;
            }
          } else {
            await prisma.employee.create({
              data: {
                id,
                ...dbEmployeeData
              }
            });
            importedCount++;
          }

          // Upsert SecurityLicense in database
          if (payload.operationType === "SECURITY_GUARDING" && payload.moiLicenseNumber) {
            const licenseData = {
              licenseNumber: payload.moiLicenseNumber,
              issueDate: payload.moiLicenseIssueDate || new Date(),
              expiryDate: payload.moiLicenseExpiryDate || new Date(),
              status: "VALID",
              documentUrl: payload.moiLicenseDocumentFile || null
            };
            const existingLic = await prisma.securityLicense.findFirst({ where: { employeeId: payload.id } });
            if (existingLic) {
              await prisma.securityLicense.update({
                where: { id: existingLic.id },
                data: licenseData
              });
            } else {
              await prisma.securityLicense.create({
                data: {
                  employeeId: payload.id,
                  ...licenseData
                }
              });
            }
          }
        } else {
          // 2. Persist to mock memory DB
          if (matchedEmp) {
            if (updateExisting) {
              await mockDb.updateEmployee(matchedEmp.id, payload);
              updatedCount++;
            } else {
              failedCount++;
              failures.push({ row: rowNum, errors: [`Employee Code ${empCode} already exists.`] });
              continue;
            }
          } else {
            await mockDb.createEmployee(payload);
            importedCount++;
          }

          // Sync SecurityLicense in mock database
          if (payload.operationType === "SECURITY_GUARDING" && payload.moiLicenseNumber) {
            const db = readDb();
            db.securityLicenses = db.securityLicenses || [];
            const licIdx = db.securityLicenses.findIndex((l: any) => l.employeeId === payload.id);
            const licData = {
              employeeId: payload.id,
              licenseType: "MOI",
              licenseNumber: payload.moiLicenseNumber,
              issueDate: payload.moiLicenseIssueDate ? payload.moiLicenseIssueDate.toISOString() : new Date().toISOString(),
              expiryDate: payload.moiLicenseExpiryDate ? payload.moiLicenseExpiryDate.toISOString() : new Date().toISOString(),
              status: "VALID",
              documentUrl: payload.moiLicenseDocumentFile || null,
              updatedAt: new Date().toISOString()
            };
            if (licIdx !== -1) {
              db.securityLicenses[licIdx] = { ...db.securityLicenses[licIdx], ...licData };
            } else {
              db.securityLicenses.push({ id: `lic-${Date.now()}`, createdAt: new Date().toISOString(), ...licData });
            }
            writeDb(db);
          }
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
        updatedCount,
        failedCount
      }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      importedRows: importedCount,
      updatedRows: updatedCount,
      failedRows: failedCount,
      failures
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to import bulk employee rows" }, { status: 500 });
  }
}
