# RUN ON SERVER
# AHH WFM -- VIBE-14 Post-Deployment Read-Only Verification Script (PowerShell 5.1 Compatible)
# Target SHA   : c44104ceb6f9a917454805f72c449e6fdbd808c3 (VIBE-14 Hotfix Target)
# Target Branch: manpower-operations-scope
# READ-ONLY: Never modifies Git, files, databases, build artifacts, or PM2 services.

param(
    [string]$RepoPath = "D:\Apps\AHH-WFM\dev",
    [string]$BackupsParent = "D:\Apps\AHH-WFM\backups",
    [string]$NormalizerScriptPath = (Join-Path $PSScriptRoot "normalize-pm2-jlist.js")
)

& {
    $ErrorActionPreference = "Continue"
    Set-StrictMode -Version Latest

    $ExpectedBranch = "manpower-operations-scope"
    $ExpectedHead   = "c44104ceb6f9a917454805f72c449e6fdbd808c3"

    $results = [ordered]@{}
    $failures = New-Object System.Collections.Generic.List[string]
    $inconclusive = New-Object System.Collections.Generic.List[string]

    function Record-Check {
        param(
            [string]$Name,
            [string]$Status, # PASS, FAIL, INCONCLUSIVE, INFO
            [string]$Details
        )
        $color = switch ($Status) {
            "PASS"         { "Green" }
            "FAIL"         { "Red" }
            "INCONCLUSIVE" { "Yellow" }
            default        { "Cyan" }
        }
        Write-Host ("[{0}] {1}: {2}" -f $Status.PadRight(12), $Name, $Details) -ForegroundColor $color
        $results[$Name] = @{ Status = $Status; Details = $Details }
        if ($Status -eq "FAIL") { $failures.Add(("{0}: {1}" -f $Name, $Details)) }
        if ($Status -eq "INCONCLUSIVE") { $inconclusive.Add(("{0}: {1}" -f $Name, $Details)) }
    }

    function Get-NormalizedPm2List {
        param([string]$NormalizerPath)
        if (-not (Test-Path -LiteralPath $NormalizerPath)) {
            return $null
        }
        try {
            $rawPm2 = (pm2 jlist) -join "`n"
            if ($LASTEXITCODE -ne 0) { return $null }
            $normOut = $rawPm2 | node $NormalizerPath
            if ($LASTEXITCODE -ne 0) { return $null }
            return ,(($normOut -join "`n") | ConvertFrom-Json)
        } catch {
            return $null
        }
    }

    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " AHH WFM -- VIBE-14 POST-DEPLOYMENT READ-ONLY VERIFICATION AUDIT  " -ForegroundColor Cyan
    Write-Host " Target Commit: $ExpectedHead                                    " -ForegroundColor Cyan
    Write-Host " Target Branch: $ExpectedBranch                                  " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    # Check 1: Repo Path & Git HEAD / Branch
    if (-not (Test-Path -LiteralPath $RepoPath)) {
        Record-Check -Name "Repo Path" -Status "FAIL" -Details "Path '$RepoPath' does not exist."
    } else {
        Set-Location -LiteralPath $RepoPath

        $curBranch = ((git branch --show-current) -join "").Trim()
        $curHead   = ((git rev-parse HEAD) -join "").Trim()

        if ($curBranch -eq $ExpectedBranch) {
            Record-Check -Name "Git Branch" -Status "PASS" -Details "Active branch is '$curBranch'."
        } else {
            Record-Check -Name "Git Branch" -Status "FAIL" -Details "Expected branch '$ExpectedBranch', found '$curBranch'."
        }

        if ($curHead -eq $ExpectedHead) {
            Record-Check -Name "Git HEAD" -Status "PASS" -Details "HEAD is exact VIBE-14 target '$curHead'."
        } else {
            Record-Check -Name "Git HEAD" -Status "FAIL" -Details "Expected HEAD '$ExpectedHead', found '$curHead'."
        }

        # Check 2: Git Working Tree Cleanliness
        $worktreeLines = @(git status --porcelain)
        $worktreeJoined = ($worktreeLines -join "`n").Trim()
        if ([string]::IsNullOrWhiteSpace($worktreeJoined)) {
            Record-Check -Name "Working Tree" -Status "PASS" -Details "Working tree is clean."
        } else {
            Record-Check -Name "Working Tree" -Status "FAIL" -Details "Working tree is dirty:`n$worktreeJoined"
        }
    }

    # Check 3: Web Login (Localhost and LAN)
    $webLoginUrls = @(
        "http://127.0.0.1:3200/login",
        "http://10.10.50.24:3200/login"
    )
    foreach ($u in $webLoginUrls) {
        try {
            $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
            if ([int]$resp.StatusCode -eq 200) {
                Record-Check -Name "Web Login ($u)" -Status "PASS" -Details "HTTP 200 OK."
            } else {
                Record-Check -Name "Web Login ($u)" -Status "FAIL" -Details "Returned HTTP $($resp.StatusCode)."
            }
        } catch {
            Record-Check -Name "Web Login ($u)" -Status "FAIL" -Details "Exception: $($_.Exception.Message)"
        }
    }

    # Check 4: Mobile Login (Localhost and LAN)
    $mobileLoginUrls = @(
        "http://127.0.0.1:3201/login",
        "http://10.10.50.24:3201/login"
    )
    foreach ($u in $mobileLoginUrls) {
        try {
            $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
            if ([int]$resp.StatusCode -eq 200) {
                Record-Check -Name "Mobile Login ($u)" -Status "PASS" -Details "HTTP 200 OK."
            } else {
                Record-Check -Name "Mobile Login ($u)" -Status "FAIL" -Details "Returned HTTP $($resp.StatusCode)."
            }
        } catch {
            Record-Check -Name "Mobile Login ($u)" -Status "FAIL" -Details "Exception: $($_.Exception.Message)"
        }
    }

    # Check 5: Commercial Auth Guard Endpoints (Unauthenticated must return HTTP 401)
    $guardedApis = @(
        "http://127.0.0.1:3200/api/v1/commercial/opportunities",
        "http://127.0.0.1:3200/api/v1/commercial/costing",
        "http://127.0.0.1:3200/api/v1/commercial/proposals"
    )
    foreach ($api in $guardedApis) {
        $statusCode = 0
        try {
            $r = Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 10
            $statusCode = [int]$r.StatusCode
        } catch {
            if ($null -ne $_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
        }
        if ($statusCode -eq 401) {
            Record-Check -Name "Auth Guard ($api)" -Status "PASS" -Details "HTTP 401 Unauthorized (Auth guard active)."
        } else {
            Record-Check -Name "Auth Guard ($api)" -Status "FAIL" -Details "Expected HTTP 401, got HTTP $statusCode."
        }
    }

    # PM2 Process Inspections (Checks 7, 8, 9)
    $pm2Procs = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath
    if ($null -eq $pm2Procs) {
        Record-Check -Name "PM2 Process Inspection" -Status "FAIL" -Details "Could not query or normalize PM2 process list."
    } else {
        # Check 7: Web and Mobile Online
        $pWeb = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
        $pMob = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }

        if ($null -ne $pWeb -and [string]$pWeb.status -eq "online") {
            Record-Check -Name "Web PM2 Service" -Status "PASS" -Details "Status 'online' (PID $($pWeb.pid), Restarts $($pWeb.restart_time))."
        } else {
            $st = if ($null -ne $pWeb) { [string]$pWeb.status } else { "absent" }
            Record-Check -Name "Web PM2 Service" -Status "FAIL" -Details "Status is '$st' (expected 'online')."
        }

        if ($null -ne $pMob -and [string]$pMob.status -eq "online") {
            Record-Check -Name "Mobile PM2 Service" -Status "PASS" -Details "Status 'online' (PID $($pMob.pid), Restarts $($pMob.restart_time))."
        } else {
            $st = if ($null -ne $pMob) { [string]$pMob.status } else { "absent" }
            Record-Check -Name "Mobile PM2 Service" -Status "FAIL" -Details "Status is '$st' (expected 'online')."
        }

        # Check 9: Commercial Reminder Worker Stopped or Absent
        $pRem = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
        if ($null -eq $pRem -or [string]$pRem.status -ne "online") {
            $remSt = if ($null -ne $pRem) { [string]$pRem.status } else { "absent" }
            Record-Check -Name "Commercial Reminder Worker" -Status "PASS" -Details "Status is '$remSt' (verified stopped/absent)."
        } else {
            Record-Check -Name "Commercial Reminder Worker" -Status "FAIL" -Details "Unexpectedly online! Must remain stopped."
        }

        # Check 8: Protected Workers State & Baseline PID / Restart Verification
        $protectedWorkers = @(
            "ahh-wfm-manpower-reconciliation-worker-dev",
            "ahh-wfm-secfac-notification-worker-dev",
            "ahh-wfm-secfac-evaluation-worker-dev",
            "ahh-wfm-secfac-monitoring-worker-dev"
        )

        # Look for baseline evidence in attempt pointer or backup manifest
        $pointerPath = Join-Path $BackupsParent "latest-vibe14-deployment-attempt.json"
        $baselineData = $null
        if (Test-Path -LiteralPath $pointerPath) {
            try {
                $ptr = (Get-Content -LiteralPath $pointerPath -Raw) | ConvertFrom-Json
                if ($null -ne $ptr.manifestPath -and (Test-Path -LiteralPath [string]$ptr.manifestPath)) {
                    $man = (Get-Content -LiteralPath [string]$ptr.manifestPath -Raw) | ConvertFrom-Json
                    if ($null -ne $man.baselineWorkers) {
                        $baselineData = $man.baselineWorkers
                    }
                }
            } catch {}
        }

        foreach ($wName in $protectedWorkers) {
            $p = $pm2Procs | Where-Object { $_.name -eq $wName }
            $wStatus  = if ($null -ne $p) { [string]$p.status } else { "absent" }
            $wPid     = if ($null -ne $p) { [int]$p.pid } else { 0 }
            $wRestart = if ($null -ne $p) { [int]$p.restart_time } else { 0 }

            if ($wStatus -ne "online") {
                Record-Check -Name "Worker Status ($wName)" -Status "FAIL" -Details "Status is '$wStatus' (expected 'online')."
            } elseif ($wRestart -gt 0) {
                Record-Check -Name "Worker Restarts ($wName)" -Status "FAIL" -Details "Restart count is $wRestart (expected 0 restart increments)."
            } else {
                Record-Check -Name "Worker Status ($wName)" -Status "PASS" -Details "Status 'online' with 0 restarts (PID $wPid)."
            }

            if ($null -ne $baselineData -and $null -ne $baselineData.$wName) {
                $basePid = [int]$baselineData.$wName.pid
                if ($wPid -eq $basePid) {
                    Record-Check -Name "Worker PID ($wName)" -Status "PASS" -Details "PID $wPid matches baseline $basePid."
                } else {
                    Record-Check -Name "Worker PID ($wName)" -Status "FAIL" -Details "PID changed from baseline $basePid to $wPid."
                }
            } else {
                Record-Check -Name "Worker Baseline Evidence ($wName)" -Status "INCONCLUSIVE" -Details "Exact pre-deploy baseline PID evidence was not stored in manifest pointer (current PID=$wPid, restarts=$wRestart, status=$wStatus)."
            }
        }
    }

    # Check 6: Inspect Web PM2 Logs for Runtime Errors
    Write-Host "`nRecent Web PM2 Logs (last 20 lines):" -ForegroundColor Cyan
    try {
        $logs = @(pm2 logs ahh-wfm-web-dev --lines 20 --nostream)
        $logJoined = $logs -join "`n"
        Write-Host $logJoined
        if ($logJoined -match "FATAL" -or $logJoined -match "UnhandledPromiseRejection") {
            Record-Check -Name "Web PM2 Logs" -Status "FAIL" -Details "Fatal errors detected in recent logs."
        } else {
            Record-Check -Name "Web PM2 Logs" -Status "PASS" -Details "No fatal errors in recent logs."
        }
    } catch {
        Record-Check -Name "Web PM2 Logs" -Status "INFO" -Details "Could not stream PM2 logs: $($_.Exception.Message)"
    }

    # Check 10 & 11: Deployment Backup Manifests & Displaced Artifact Disposition
    $pointerFile = Join-Path $BackupsParent "latest-vibe14-deployment-attempt.json"
    if (Test-Path -LiteralPath $pointerFile) {
        try {
            $pData = (Get-Content -LiteralPath $pointerFile -Raw) | ConvertFrom-Json
            Record-Check -Name "Deployment Attempt Pointer" -Status "PASS" -Details "Pointer exists: deploymentId=$($pData.deploymentId), backupRoot=$($pData.backupRoot)."

            if (Test-Path -LiteralPath [string]$pData.manifestPath) {
                $mObj = (Get-Content -LiteralPath [string]$pData.manifestPath -Raw) | ConvertFrom-Json
                Record-Check -Name "Backup Manifest" -Status "PASS" -Details "Manifest exists, preWebBuildId=$($mObj.preWebBuildId), fileCount=$($mObj.webNextFileCount)."
            } else {
                Record-Check -Name "Backup Manifest" -Status "FAIL" -Details "Manifest '$($pData.manifestPath)' missing."
            }

            # Check for displaced artifacts
            $displacedItems = Get-ChildItem -Path (Join-Path $RepoPath "apps\web") -Filter "*.displaced-*"
            if ($displacedItems.Count -gt 0) {
                $dispPath = $displacedItems[0].FullName
                Record-Check -Name "Displaced Artifact Retention" -Status "PASS" -Details ("Displaced build directory retained at '{0}' (safe; no data loss)." -f $dispPath)
            } else {
                Record-Check -Name "Displaced Artifact Retention" -Status "INFO" -Details "No active .displaced-* directory found in apps/web."
            }
        } catch {
            Record-Check -Name "Deployment Backup Check" -Status "FAIL" -Details "Error reading backup metadata: $($_.Exception.Message)"
        }
    } else {
        Record-Check -Name "Deployment Attempt Pointer" -Status "INCONCLUSIVE" -Details "Pointer file '$pointerFile' not found."
    }

    # Final Summary & Recommendation
    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " FINAL POST-DEPLOYMENT VERIFICATION SUMMARY                      " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $finalVerdict = "PASS"
    if ($failures.Count -gt 0) {
        $finalVerdict = "FAIL"
    } elseif ($inconclusive.Count -gt 0) {
        $finalVerdict = "INCONCLUSIVE"
    }

    Write-Host "Verdict: $finalVerdict" -ForegroundColor $(if ($finalVerdict -eq "PASS") { "Green" } elseif ($finalVerdict -eq "FAIL") { "Red" } else { "Yellow" })
    if ($failures.Count -gt 0) {
        Write-Host "`nFailures ($($failures.Count)):" -ForegroundColor Red
        foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
    }
    if ($inconclusive.Count -gt 0) {
        Write-Host "`nInconclusive items ($($inconclusive.Count)):" -ForegroundColor Yellow
        foreach ($inc in $inconclusive) { Write-Host "  - $inc" -ForegroundColor Yellow }
    }

    Write-Host "`nVerification complete. Result: $finalVerdict"
}
