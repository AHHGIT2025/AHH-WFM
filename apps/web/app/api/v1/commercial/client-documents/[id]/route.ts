import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const doc = await prisma.manpowerClientDocument.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        contract: true,
        clientResponse: true
      }
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch document." },
      { status: 500 }
    );
  }
}
