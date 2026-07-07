import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const csvContent = "employeeCode,fullName,email,phone,companyCode,department,designation,employeeCategory,operationType,defaultLocation,dateOfJoining,nationality,gender,dateOfBirth," +
    "qidNumber,qidIssueDate,qidExpiryDate," +
    "passportNumber,passportIssueDate,passportExpiryDate,passportIssuingCountry," +
    "visaNumber,visaIssueDate,visaExpiryDate," +
    "workPermitNumber,workPermitExpiryDate," +
    "moiLicenseNumber,moiLicenseIssueDate,moiLicenseExpiryDate," +
    "securityTrainingCertificateNumber,securityTrainingExpiryDate," +
    "siteGatePassNumber,siteGatePassExpiryDate," +
    "tradeSkill,skillCertificateNumber,skillCertificateExpiryDate," +
    "healthCardNumber,healthCardExpiryDate," +
    "qidDocumentFile,passportDocumentFile,visaDocumentFile,workPermitDocumentFile,moiLicenseDocumentFile,trainingCertificateFile,gatePassFile,healthCardFile\n" +
    
    // Security Guarding example
    "SG-007,Mohammed Ali,mohammed.ali@alhattab.qa,+974 5555 0007,HS01,Security Guarding,Security Guard,BLUE_COLLAR,SECURITY_GUARDING,Doha HQ,2024-01-01,Qatar,Male,1995-05-15," +
    "29532400123,2024-01-10,2029-01-10," +
    "P1000007,2023-11-20,2033-11-20,Qatar," +
    "V7700007,2023-12-01,2025-12-01," +
    "WP7700007,2025-12-01," +
    "MOI-998877,2024-01-15,2026-01-15," +
    "STC-554433,2026-01-15," +
    "GP-4422,2025-01-01," +
    ",,," + // tradeSkill, skillCertificateNumber, skillCertificateExpiryDate
    ",," + // healthCardNumber, healthCardExpiryDate
    "qid_sg_007.pdf,passport_sg_007.pdf,visa_sg_007.pdf,wp_sg_007.pdf,moi_sg_007.pdf,stc_sg_007.pdf,gp_sg_007.pdf,\n" +
    
    // Facility Management example
    "FM-101,John Smith,john.smith@alhattab.qa,+974 5555 0101,HS02,Facility Management,Electrician,BLUE_COLLAR,FACILITY_MANAGEMENT,Lusail Site,2024-02-01,India,Male,1990-08-20," +
    "29035600456,2024-02-05,2029-02-05," +
    "P2000101,2023-10-10,2033-10-10,India," +
    "V8800101,2024-01-01,2026-01-01," +
    "WP880101,2026-01-01," +
    ",,," + // moiLicenseNumber, moiLicenseIssueDate, moiLicenseExpiryDate
    "," + // securityTrainingCertificateNumber, securityTrainingExpiryDate
    "," + // siteGatePassNumber, siteGatePassExpiryDate
    "Electrician,ELEC-CERT-908,2027-02-01," +
    "HC-12345,2025-02-01," +
    "qid_fm_101.pdf,passport_fm_101.pdf,visa_fm_101.pdf,wp_fm_101.pdf,,,,hc_fm_101.pdf\n";

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ahh_wfm_bulk_upload_template.csv"
    }
  });
}
