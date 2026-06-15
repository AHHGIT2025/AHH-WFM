import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const csvContent = "employeeId,fullName,email,phone,department,role,employmentStatus,dutyStatus,workerCategory,positionCategory,defaultProjectCode,defaultSiteCode,costCenter,managerEmployeeId,location,companyCode,qidNumber,qidExpiryDate,passportNumber,passportIssueDate,passportExpiryDate,passportIssuingCountry,dateOfJoining,sponsor\n" +
    "SK-99001,John Doe,john.doe@alhattab.qa,+974 5555 9999,Operations,EMPLOYEE,ACTIVE,OFF_DUTY,WHITE_COLLAR,,,,CC-101,,Doha HQ,AHH,28532400123,2027-05-20,P0000001,2022-01-15,2032-01-15,Qatar,2022-01-15,Al Hattab Holding\n" +
    "SK-99002,Jane Smith,jane.s@alhattab.qa,+974 5555 8888,Engineering,EMPLOYEE,ACTIVE,OFF_DUTY,BLUE_COLLAR,Carpenter,PRJ-LUSAIL,SITE-LUSAIL-A,CC-102,SK-90210,Lusail Site,AHH,28932400456,2026-12-15,P0000002,2023-04-10,2033-04-10,Spain,2023-04-10,Al Hattab Holding\n";

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ahh_wfm_bulk_upload_template.csv"
    }
  });
}
