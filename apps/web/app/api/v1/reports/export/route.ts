import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { ReportService } from "@/lib/report-service";
import { mockDb } from "@ahh-wfm/mock-data";
import * as fs from "fs";
import * as path from "path";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "HR", "FINANCE"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any).id;

  try {
    const payload = await request.json();
    const { reportType, exportFormat, filters, reportName } = payload;

    if (!reportType || !exportFormat) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch data based on report type
    let dataToExport: any = {};
    if (reportType === "ATTENDANCE") {
      dataToExport = await ReportService.getAttendanceReport(filters || {});
    } else if (reportType === "LEAVE") {
      dataToExport = await ReportService.getLeaveReport(filters || {});
    } else if (reportType === "OVERTIME") {
      dataToExport = await ReportService.getOvertimeReport(filters || {});
    } else if (reportType === "SHIFTS") {
      dataToExport = await ReportService.getShiftReport(filters || {});
    } else if (reportType === "SAP") {
      dataToExport = await ReportService.getSapReport();
    } else {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    // 2. Generate export content
    let content = "";
    let fileExtension = "";
    let mimeType = "";

    if (exportFormat === "JSON") {
      content = JSON.stringify(dataToExport, null, 2);
      fileExtension = ".json";
      mimeType = "application/json";
    } else if (exportFormat === "CSV") {
      content = convertToCSV(reportType, dataToExport);
      fileExtension = ".csv";
      mimeType = "text/csv";
    } else if (exportFormat === "PDF" || exportFormat === "EXCEL") {
      // PDF/Excel placeholders as requested
      content = `PLACEHOLDER: ${reportName || reportType} Report Export in ${exportFormat} Format.\nDate: ${new Date().toISOString()}\nExported By: ${userId}\nRecord Count: 0`;
      fileExtension = exportFormat === "PDF" ? ".pdf" : ".xlsx";
      mimeType = exportFormat === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
    }

    // 3. Define save path under storage/exports/
    const exportDir = path.join(process.cwd(), "storage", "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const uniqueId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const fileName = `${reportType.toLowerCase()}_export_${uniqueId}${fileExtension}`;
    const filePath = path.join(exportDir, fileName);

    // Save file locally (not in public folders)
    fs.writeFileSync(filePath, content, "utf8");
    const fileSize = fs.statSync(filePath).size;

    // 4. Save audit log record to ReportExportLog
    await mockDb.createReportExportLog({
      reportType,
      exportFormat,
      filtersJson: JSON.stringify(filters || {}),
      fileName,
      filePath,
      fileSize,
      exportedById: userId
    });

    // Also write to UserActivityLog
    await mockDb.createUserActivityLog({
      userId,
      action: `REPORT_EXPORT_${exportFormat}`,
      entityType: "SavedReport",
      entityId: uniqueId,
      beforeJson: undefined,
      afterJson: JSON.stringify({ fileName, fileSize }),
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined
    });

    // 5. Return success and download information
    return NextResponse.json({
      success: true,
      fileName,
      fileSize,
      mimeType,
      data: exportFormat === "JSON" || exportFormat === "CSV" ? content : undefined,
      downloadUrl: `/api/v1/reports/download?file=${fileName}` // download endpoint to retrieve local file securely
    });
  } catch (e) {
    console.error("Export error", e);
    return NextResponse.json({ error: "Failed to perform export operation" }, { status: 500 });
  }
}

function convertToCSV(reportType: string, data: any): string {
  let headers: string[] = [];
  let rows: any[] = [];

  if (reportType === "ATTENDANCE") {
    headers = ["ID", "Employee ID", "Employee Name", "Check In", "Check Out", "Status", "Location", "Late Minutes"];
    const records = data.dailyAttendance || [];
    rows = records.map((r: any) => [
      r.id, r.employeeId, r.employeeName, r.checkIn, r.checkOut || "N/A", r.status, r.locationName, r.lateMinutes
    ]);
  } else if (reportType === "LEAVE") {
    headers = ["ID", "Employee ID", "Employee Name", "Type", "Date Range", "Status", "Total Days", "Submitted At"];
    const records = data.approvedRejectedLeaves || [];
    rows = records.map((r: any) => [
      r.id, r.employeeId, r.employeeName, r.type, r.dateRange, r.status, r.totalDays || 0, r.submittedAt
    ]);
  } else if (reportType === "OVERTIME") {
    headers = ["ID", "Employee ID", "Employee Name", "Check In", "OT Status", "Standard OT (m)", "Weekend OT (m)", "Holiday OT (m)", "Night OT (m)", "Pay Amount QAR"];
    const records = data.approvedOvertime || [];
    rows = records.map((r: any) => [
      r.id, r.employeeId, r.employeeName, r.checkIn, r.otStatus, r.standardOtMinutes || 0, r.weekendOtMinutes || 0, r.holidayOtMinutes || 0, r.nightOtMinutes || 0, r.overtimePayAmount || 0
    ]);
  } else if (reportType === "SHIFTS") {
    headers = ["ID", "Employee ID", "Date", "Shift Template ID"];
    const records = data.shiftAssignments || [];
    rows = records.map((r: any) => [
      r.id, r.employeeId, r.date, r.shiftTemplateId
    ]);
  } else if (reportType === "SAP") {
    headers = ["Metric", "Value"];
    const status = data.exportQueueStatus || {};
    rows = [
      ["Pending Queue Count", status.PENDING || 0],
      ["Processing Queue Count", status.PROCESSING || 0],
      ["Sent Queue Count", status.SENT || 0],
      ["Failed Queue Count", status.FAILED || 0]
    ];
  }

  const csvRows = [
    headers.join(","),
    ...rows.map(row => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))
  ];
  return csvRows.join("\n");
}
