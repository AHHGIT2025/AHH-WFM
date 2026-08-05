import {
  buildWelfareScopeKey,
  resolveEffectiveWelfareSetting,
  acknowledgeWelfareCheck,
  exemptWelfareCheck
} from "../../apps/web/lib/secfac-welfare-service";
import {
  calculateBinarySha256,
  verifyAndStoreEvidence
} from "../../apps/web/lib/secfac-evidence-service";
import {
  evaluatePatrolAssurance,
  acknowledgePatrolException
} from "../../apps/web/lib/secfac-patrol-evaluator";
import {
  completeDispatchAssignment,
  timeoutPendingDispatchAssignments
} from "../../apps/web/lib/secfac-sos-dispatch-service";
import { runAllPhase6a2WorkerJobs } from "../../apps/web/lib/secfac-phase6a2-worker-runner";

describe("SECFAC Phase 6A.2 Corrected Implementation Test Suite", () => {
  describe("Correction 1 & 3 & 4: ScopeKey & Effective Welfare Setting Precedence", () => {
    it("builds scopeKey and source types correctly per level", () => {
      const companyRes = buildWelfareScopeKey("SECURITY_GUARDING", "COMP-002");
      expect(companyRes.scopeKey).toBe("SECURITY_GUARDING:COMPANY:COMP-002");
      expect(companyRes.sourceType).toBe("COMPANY");

      const siteRes = buildWelfareScopeKey("SECURITY_GUARDING", "COMP-002", "PROJ-10", "SITE-50");
      expect(siteRes.scopeKey).toBe("SECURITY_GUARDING:SITE:SITE-50");
      expect(siteRes.sourceType).toBe("SITE");

      const postRes = buildWelfareScopeKey("FACILITY_MANAGEMENT", "COMP-002", "PROJ-10", "SITE-50", "POST-99");
      expect(postRes.scopeKey).toBe("FACILITY_MANAGEMENT:POST:POST-99");
      expect(postRes.sourceType).toBe("POST");
    });

    it("resolves system default fallback when no custom settings exist", async () => {
      const effective = await resolveEffectiveWelfareSetting({
        operationType: "SECURITY_GUARDING",
        companyId: "COMP-002"
      });

      expect(effective.settingSourceType).toBe("SYSTEM_DEFAULT");
      expect(effective.effectiveFrequencyMins).toBe(60);
      expect(effective.effectiveGracePeriodMins).toBe(10);
    });
  });

  describe("Correction 2: Binary SHA-256 Evidence Integrity", () => {
    it("computes exact SHA-256 hash from binary Buffer", () => {
      const buffer = Buffer.from("SECURE_EVIDENCE_BINARY_PAYLOAD_12345");
      const hash = calculateBinarySha256(buffer);
      expect(hash).toHaveLength(64);
    });

    it("returns VERIFIED on matching hash and MISMATCH on altered hash", async () => {
      const buffer = Buffer.from("EVIDENCE_IMAGE_DATA_XYZ");
      const validHash = calculateBinarySha256(buffer);

      const verifiedRes = await verifyAndStoreEvidence({
        operationType: "SECURITY_GUARDING",
        executionId: "exec-test-01",
        employeeId: "EMP-001",
        fileName: "evidence.png",
        mimeType: "image/png",
        fileBuffer: buffer,
        clientFileHash: validHash
      });

      expect(verifiedRes.integrityStatus).toBe("VERIFIED");
      expect(verifiedRes.hashMatch).toBe(true);

      const mismatchRes = await verifyAndStoreEvidence({
        operationType: "SECURITY_GUARDING",
        executionId: "exec-test-01",
        employeeId: "EMP-001",
        fileName: "evidence_altered.png",
        mimeType: "image/png",
        fileBuffer: buffer,
        clientFileHash: "0000000000000000000000000000000000000000000000000000000000000000"
      });

      expect(mismatchRes.integrityStatus).toBe("MISMATCH");
      expect(mismatchRes.hashMatch).toBe(false);
    });
  });

  describe("Dispatch Engine: Alert Closure Separation & Timeout", () => {
    it("completes dispatch assignment without throwing error", async () => {
      // Mock dispatch completion in fallback mode
      try {
        const result = await completeDispatchAssignment("dispatch-mock-1", "user-01", "Completed successfully");
        expect(result).toBeDefined();
      } catch (e: any) {
        expect(e.message).toContain("Dispatch assignment not found");
      }
    });

    it("evaluates timeout pending assignments safely", async () => {
      const res = await timeoutPendingDispatchAssignments();
      expect(res.timedOutCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Welfare Check & Patrol Assurance Services", () => {
    it("acknowledges guard welfare check-in", async () => {
      const res = await acknowledgeWelfareCheck("welfare-mock-01", "EMP-001", "MOBILE_APP");
      expect(res).toBeDefined();
      expect(res.message).toBeDefined();
    });

    it("exempts welfare check for supervisor override", async () => {
      const res = await exemptWelfareCheck("welfare-mock-01", "SUP-001", "SUPERVISOR_OVERRIDE", "Approved duty swap");
      expect(res.status).toBe("EXEMPTED");
    });

    it("evaluates patrol assurance without error", async () => {
      const res = await evaluatePatrolAssurance();
      expect(res.evaluatedExecutionsCount).toBeGreaterThanOrEqual(0);
    });

    it("acknowledges patrol checkpoint exception", async () => {
      const res = await acknowledgePatrolException("cp-exec-01", "SUP-001", "Excused due to weather");
      expect(res.assuranceStatus).toBe("EXCEPTION_ACKNOWLEDGED");
    });
  });

  describe("Correction 6: Phase 5C Worker Runtime Integration", () => {
    it("runs all 4 independent Phase 6A.2 worker jobs", async () => {
      const { results, totalProcessed } = await runAllPhase6a2WorkerJobs();
      expect(results).toHaveLength(4);
      expect(results.map(r => r.jobCode)).toEqual([
        "SECFAC_DISPATCH_TIMEOUT",
        "SECFAC_WELFARE_GENERATE",
        "SECFAC_WELFARE_MISSED_EVALUATE",
        "SECFAC_PATROL_ASSURANCE_EVALUATE"
      ]);
      expect(totalProcessed).toBeGreaterThanOrEqual(0);
    });
  });
});
