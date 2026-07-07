import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { MASTER_SCHEMAS } from "@/lib/masters-schema";

export async function GET(request: Request, { params }: { params: { entity: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { entity } = params;
  const schema = MASTER_SCHEMAS[entity];
  if (!schema) {
    return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
  }

  // Generate headers from column definitions
  // If select and has referenceKey, use referenceKey (e.g. companyCode instead of companyId)
  const headers = schema.columns.map(col => col.referenceKey || col.key);
  
  // Add some sample data row
  const sampleRow: string[] = [];
  schema.columns.forEach(col => {
    if (col.key === "companyId" || col.referenceKey === "companyCode") {
      sampleRow.push("AHH");
    } else if (col.key === "projectId" || col.referenceKey === "projectCode") {
      sampleRow.push("PRJ-101");
    } else if (col.key === "locationId" || col.referenceKey === "locationCode") {
      sampleRow.push("L-DOHA");
    } else if (col.key === "companyCode" || col.key === "code") {
      sampleRow.push("CODE-001");
    } else if (col.key === "companyName" || col.key === "name") {
      sampleRow.push("Sample Name");
    } else if (col.type === "boolean") {
      sampleRow.push("true");
    } else if (col.type === "number") {
      sampleRow.push("100");
    } else {
      sampleRow.push("Sample Text");
    }
  });

  const csvContent = headers.join(",") + "\n" + sampleRow.join(",") + "\n";

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=ahh_wfm_master_${entity}_template.csv`
    }
  });
}
