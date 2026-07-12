# OWASP ZAP Baseline Security Scan Guide

This guide details how to perform a security baseline scan against the AHH WFM web application using **OWASP ZAP** (Zed Attack Proxy).

---

## 1. Important Security Rules

> [!CAUTION]
> **Production Scanning Restriction**: Never run active/aggressive vulnerability scans against production servers (`http://10.10.50.24:3200` or public domains) without explicit written approval from management and a scheduled maintenance window. Active scanning can cause denial of service or generate corrupt transaction logs in the database.

*   Only scan your **local environment** (`http://localhost:3100`) or approved staging environments.
*   Make sure database backups are executed before running any active scan.

---

## 2. Quick Setup & Scan Procedures

### Option A: Running ZAP Desktop Client (GUI)
1. Download and install [OWASP ZAP Desktop](https://www.zaproxy.org/download/).
2. Start the local AHH WFM dev server.
3. In the ZAP UI, locate the **Quick Start** tab.
4. Input the Target URL: `http://localhost:3100`.
5. Click **Attack** (this runs a safe passive spider and baseline active scan).

### Option B: Running ZAP Baseline Scan (Docker Command Line)
If you prefer running scans in a CI/CD pipeline or command line, use the official Docker image:

```bash
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://localhost:3100
```

---

## 3. High-Priority Vulnerabilities to Monitor

When reviewing the generated ZAP PDF/HTML report, verify the following findings:

1.  **Missing Security Headers**:
    *   `X-Frame-Options` (protects against Clickjacking).
    *   `Content-Security-Policy` (CSP - mitigates XSS risks).
    *   `Strict-Transport-Security` (HSTS - enforces HTTPS).
2.  **Insecure Cookie Flags**:
    *   Verify the NextAuth session cookie (`__Secure-next-auth.session-token`) has `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict` set.
3.  **Exposed Error Traces**:
    *   Inspect if API 500 errors print internal SQL queries or NextJS server stack traces to unauthenticated clients.
4.  **Cross-Site Scripting (XSS)**:
    *   Monitor if inputs in forms (e.g. Add Employee, Create Contract) are sanitized before being rendered to other users.
