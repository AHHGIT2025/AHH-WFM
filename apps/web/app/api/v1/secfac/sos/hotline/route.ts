import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationType = (searchParams.get("operationType") || "SECURITY_GUARDING") as any;
    const siteId = searchParams.get("siteId");

    const auth = await checkApiAuth(undefined, { requiredOperation: operationType });
    if (auth.error) return auth.error;

    // Check system channel configuration or site settings for emergency hotline
    const channelConfig = await prisma.secFacChannelConfiguration.findFirst({
      where: {
        operationType,
        channel: "IN_APP",
        isEnabled: true
      }
    });

    const settings = (channelConfig?.settings as any) || {};
    const hotline = settings.emergencyHotline || process.env.SECFAC_CONTROL_ROOM_HOTLINE || null;

    if (!hotline) {
      return NextResponse.json({
        available: false,
        hotline: null,
        message: "No approved control room hotline configured."
      });
    }

    return NextResponse.json({
      available: true,
      hotline,
      operationType,
      siteId
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/sos/hotline error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
