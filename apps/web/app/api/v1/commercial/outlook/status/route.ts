import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.activity.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const azureTenantId = process.env.AZURE_TENANT_ID;
  const azureClientId = process.env.AZURE_CLIENT_ID;
  const azureClientSecret = process.env.AZURE_CLIENT_SECRET;

  const isConfigured = Boolean(azureTenantId && azureClientId && azureClientSecret);

  return NextResponse.json({
    success: true,
    configured: isConfigured,
    status: isConfigured
      ? "OUTLOOK_GRAPH_INTEGRATION_CONFIGURED"
      : "OUTLOOK_INTEGRATION_NOT_CONFIGURED",
    capabilities: {
      manualMetadataLinking: true,
      graphMailboxSync: isConfigured,
      graphCalendarSync: isConfigured
    },
    message: isConfigured
      ? "Microsoft Graph API configuration detected."
      : "Microsoft Entra ID / Outlook configuration is pending. Manual Outlook metadata linkage is enabled."
  });
}
