import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const csvContent = "employeeId,fullName,email,phone,department,role,employmentStatus,dutyStatus,workerCategory,positionCategory,defaultProjectCode,defaultSiteCode,costCenter,managerEmployeeId,location,joiningDate\n" +
    "SK-99001,John Doe,john.doe@alhattab.qa,+974 5555 9999,Operations,EMPLOYEE,ACTIVE,OFF_DUTY,WHITE_COLLAR,,,,CC-101,,Doha HQ,2026-06-01\n" +
    "SK-99002,Jane Smith,jane.s@alhattab.qa,+974 5555 8888,Engineering,EMPLOYEE,ACTIVE,OFF_DUTY,BLUE_COLLAR,Carpenter,PRJ-LUSAIL,SITE-LUSAIL-A,CC-102,SK-90210,Lusail Site,2026-06-10\n";

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ahh_wfm_bulk_upload_template.csv"
    }
  });
}
