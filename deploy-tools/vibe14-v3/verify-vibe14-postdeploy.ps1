# RUN ON SERVER
# AHH WFM -- VIBE-14 Post-Deployment Read-Only Verification Script (PowerShell 5.1 Compatible)
# Target SHA   : c44104ceb6f9a917454805f72c449e6fdbd808c3 (VIBE-14 Hotfix Target)
# Target Branch: manpower-operations-scope
# READ-ONLY: Never modifies Git, files, databases, build artifacts, or PM2 services.

param(
    [string]$RepoPath = "D:\Apps\AHH-WFM\dev",
    [string]$BackupsParent = "D:\Apps\AHH-WFM\backups",
    [string]$BackupRoot = "",
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

    # Safely retrieve a property from a PSCustomObject without throwing under StrictMode
    function Get-SafeProperty {
        param(
            [Parameter(Mandatory = $false)]$Object,
            [Parameter(Mandatory = $true)][string]$PropertyName,
            $DefaultValue = $null
        )
        if ($null -eq $Object) { return $DefaultValue }
        try {
            $prop = $Object.PSObject.Properties[$PropertyName]
            if ($null -ne $prop) {
                return $prop.Value
            }
        } catch {
            return $DefaultValue
        }
        return $DefaultValue
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

    # PM2 Process Inspections (Checks 6, 7, 8, 9)
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

        $historicalPids = @{
            "ahh-wfm-manpower-reconciliation-worker-dev" = 6816
            "ahh-wfm-secfac-notification-worker-dev"     = 6912
            "ahh-wfm-secfac-evaluation-worker-dev"       = 6924
            "ahh-wfm-secfac-monitoring-worker-dev"       = 2572
        }

        # Look for baseline evidence in attempt pointer or backup manifest
        $pointerPath = Join-Path $BackupsParent "latest-vibe14-deployment-attempt.json"
        $baselineData = $null
        if (Test-Path -LiteralPath $pointerPath) {
            try {
                $ptr = (Get-Content -LiteralPath $pointerPath -Raw) | ConvertFrom-Json
                $mPath = Get-SafeProperty $ptr "manifestPath"
                if ($null -ne $mPath -and (Test-Path -LiteralPath [string]$mPath)) {
                    $man = (Get-Content -LiteralPath [string]$mPath -Raw) | ConvertFrom-Json
                    $baselineData = Get-SafeProperty $man "baselineWorkers"
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
                Record-Check -Name "Worker Restarts ($wName)" -Status "FAIL" -Details "Restart count is $wRestart (expected 0)."
            } else {
                Record-Check -Name "Worker Status ($wName)" -Status "PASS" -Details "Status 'online' with 0 restarts (PID $wPid)."
            }

            # Baseline PID verification
            $baselinePid = $null
            $baselineSource = ""
            if ($null -ne $baselineData) {
                $workerObj = Get-SafeProperty $baselineData $wName
                if ($null -ne $workerObj) {
                    $baselinePid = [int](Get-SafeProperty $workerObj "pid" 0)
                    $baselineSource = "manifest"
                }
            }
            if ($null -eq $baselinePid -or $baselinePid -eq 0) {
                if ($historicalPids.ContainsKey($wName)) {
                    $baselinePid = $historicalPids[$wName]
                    $baselineSource = "historical preflight"
                }
            }

            if ($null -ne $baselinePid -and $baselinePid -gt 0) {
                if ($wPid -eq $baselinePid) {
                    Record-Check -Name "Worker PID ($wName)" -Status "PASS" -Details ("PID {0} matches {1} baseline {2}." -f $wPid, $baselineSource, $baselinePid)
                } else {
                    Record-Check -Name "Worker PID ($wName)" -Status "FAIL" -Details ("PID {0} does not match {1} baseline {2}." -f $wPid, $baselineSource, $baselinePid)
                }
            } else {
                Record-Check -Name "Worker PID ($wName)" -Status "INCONCLUSIVE" -Details ("No baseline PID evidence available (current PID={0}, status={1}, restarts={2})." -f $wPid, $wStatus, $wRestart)
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

    # =================================================================
    # Check 10 & 11: Deployment Backup Resolution, Catalog Hashing & Displaced Artifacts
    # =================================================================
    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " BACKUP VERIFICATION & DISPLACED ARTIFACT AUDIT                  " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $resolvedBackupRoot = ""
    $pointerFile = Join-Path $BackupsParent "latest-vibe14-deployment-attempt.json"
    $ptrObj = $null

    # 1. Inspect Attempt Pointer (if present)
    if (Test-Path -LiteralPath $pointerFile) {
        try {
            $ptrObj = (Get-Content -LiteralPath $pointerFile -Raw) | ConvertFrom-Json
            $ptrDepId = Get-SafeProperty $ptrObj "deploymentId" "unknown"
            $ptrRoot  = Get-SafeProperty $ptrObj "backupRoot" ""
            Record-Check -Name "Deployment Attempt Pointer" -Status "PASS" -Details ("Pointer exists at '{0}' (deploymentId={1}, backupRoot={2})." -f $pointerFile, $ptrDepId, $ptrRoot)
            if (-not [string]::IsNullOrWhiteSpace($ptrRoot) -and (Test-Path -LiteralPath $ptrRoot)) {
                $resolvedBackupRoot = $ptrRoot
            }
        } catch {
            Record-Check -Name "Deployment Attempt Pointer" -Status "FAIL" -Details ("Error parsing pointer file: $($_.Exception.Message)")
        }
    } else {
        Record-Check -Name "Deployment Attempt Pointer" -Status "INCONCLUSIVE" -Details ("Pointer file '{0}' not found." -f $pointerFile)
    }

    # 2. Resolve Backup Directory
    if (-not [string]::IsNullOrWhiteSpace($BackupRoot) -and (Test-Path -LiteralPath $BackupRoot)) {
        $resolvedBackupRoot = $BackupRoot
    } elseif ([string]::IsNullOrWhiteSpace($resolvedBackupRoot)) {
        # Discover candidate backup directories under $BackupsParent
        if (Test-Path -LiteralPath $BackupsParent) {
            $candidates = @(Get-ChildItem -LiteralPath $BackupsParent -Directory | Where-Object {
                $_.Name -like "pre-deploy-vibe14-$ExpectedHead-*" -or $_.Name -like "pre-deploy-vibe14-*"
            } | Sort-Object CreationTime -Descending)
            if ($candidates.Count -gt 0) {
                $resolvedBackupRoot = $candidates[0].FullName
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolvedBackupRoot) -or -not (Test-Path -LiteralPath $resolvedBackupRoot)) {
        Record-Check -Name "Backup Directory Resolution" -Status "INCONCLUSIVE" -Details ("No backup directory found in '{0}'." -f $BackupsParent)
    } else {
        Record-Check -Name "Backup Directory Resolution" -Status "PASS" -Details ("Resolved backup directory: '{0}'." -f $resolvedBackupRoot)

        # 3. Check for package.json.bak
        $pkgBak = Join-Path $resolvedBackupRoot "package.json.bak"
        if (Test-Path -LiteralPath $pkgBak) {
            Record-Check -Name "Backup Package JSON" -Status "PASS" -Details ("'package.json.bak' exists in backup directory.")
        } else {
            Record-Check -Name "Backup Package JSON" -Status "INFO" -Details ("'package.json.bak' not present in backup directory (non-critical).")
        }

        # 4. Resolve and Validate Backup Manifest
        $manifestPath = ""
        $ptrManifest = Get-SafeProperty $ptrObj "manifestPath" ""
        if (-not [string]::IsNullOrWhiteSpace($ptrManifest) -and (Test-Path -LiteralPath $ptrManifest)) {
            $manifestPath = $ptrManifest
        } else {
            $directManifest = Join-Path $resolvedBackupRoot "backup-manifest.json"
            if (Test-Path -LiteralPath $directManifest) {
                $manifestPath = $directManifest
            }
        }

        if ([string]::IsNullOrWhiteSpace($manifestPath) -or -not (Test-Path -LiteralPath $manifestPath)) {
            Record-Check -Name "Backup Manifest" -Status "FAIL" -Details ("'backup-manifest.json' missing from backup root '{0}'." -f $resolvedBackupRoot)
        } else {
            try {
                $mRaw = Get-Content -LiteralPath $manifestPath -Raw
                $mObj = $mRaw | ConvertFrom-Json

                $mTargetSha        = Get-SafeProperty $mObj "targetSha" "unknown"
                $mBaselineSha      = Get-SafeProperty $mObj "baselineSha" "unknown"
                $mPreWebBuildId    = Get-SafeProperty $mObj "preWebBuildId" "unknown"
                $mIsRollbackReady  = Get-SafeProperty $mObj "isRollbackReady" $false
                $mFileCount        = Get-SafeProperty $mObj "webNextFileCount" $null
                $catalogObj        = Get-SafeProperty $mObj "webNextFileCatalog" $null

                Record-Check -Name "Backup Manifest" -Status "PASS" -Details ("Manifest exists at '{0}' (baseline={1}, target={2}, preWebBuildId={3}, rollbackReady={4})." -f $manifestPath, $mBaselineSha, $mTargetSha, $mPreWebBuildId, $mIsRollbackReady)

                # 5. Verify Actual Web Backup Directory & 100% SHA-256 File Catalog
                $bakWebNext = Join-Path $resolvedBackupRoot "web-next"
                if (-not (Test-Path -LiteralPath $bakWebNext)) {
                    Record-Check -Name "Backup Web-Next Directory" -Status "FAIL" -Details ("'web-next' directory missing from backup '{0}'." -f $resolvedBackupRoot)
                } else {
                    $resolvedWebNextRoot = (Resolve-Path -LiteralPath $bakWebNext).Path.TrimEnd('\')
                    $actualFiles = @([System.IO.Directory]::GetFiles($resolvedWebNextRoot, "*", [System.IO.SearchOption]::AllDirectories))
                    $actualCount = $actualFiles.Count

                    if ($null -ne $catalogObj) {
                        $expectedProps = @($catalogObj.PSObject.Properties)
                        $expectedCount = $expectedProps.Count

                        if ($null -ne $mFileCount -and [int]$mFileCount -ne $expectedCount) {
                            Record-Check -Name "Backup Manifest Count Consistency" -Status "FAIL" -Details ("Manifest webNextFileCount={0} differs from catalog property count={1}." -f $mFileCount, $expectedCount)
                        } else {
                            Record-Check -Name "Backup Manifest Count Consistency" -Status "PASS" -Details ("Manifest file count={0} is internally consistent." -f $expectedCount)
                        }

                        if ($actualCount -ne $expectedCount) {
                            Record-Check -Name "Backup File Inventory Count" -Status "FAIL" -Details ("Actual files in web-next ({0}) does not match manifest count ({1})." -f $actualCount, $expectedCount)
                        } else {
                            Record-Check -Name "Backup File Inventory Count" -Status "PASS" -Details ("Actual file count in web-next matches manifest: {0} files." -f $actualCount)
                        }

                        # Compute and verify SHA-256 for all cataloged files
                        $sha = [System.Security.Cryptography.SHA256]::Create()
                        $hashMismatches = New-Object System.Collections.Generic.List[string]
                        $missingFiles   = New-Object System.Collections.Generic.List[string]
                        $checkedCount   = 0
                        $sw = [System.Diagnostics.Stopwatch]::StartNew()

                        foreach ($prop in $expectedProps) {
                            $relPath = $prop.Name
                            $expectedHash = [string]$prop.Value
                            $fullPath = Join-Path $resolvedWebNextRoot $relPath

                            if (-not (Test-Path -LiteralPath $fullPath)) {
                                $missingFiles.Add($relPath)
                                continue
                            }
                            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
                            $actualHash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-'
                            if ($actualHash -ne $expectedHash) {
                                $hashMismatches.Add(("{0} (expected {1}, got {2})" -f $relPath, $expectedHash, $actualHash))
                            }
                            $checkedCount++
                        }
                        $sw.Stop()

                        if ($missingFiles.Count -eq 0 -and $hashMismatches.Count -eq 0) {
                            Record-Check -Name "Backup File Hash Verification" -Status "PASS" -Details ("100% SHA-256 match verified across all {0} backup files against manifest in {1} ms." -f $checkedCount, $sw.ElapsedMilliseconds)
                        } else {
                            Record-Check -Name "Backup File Hash Verification" -Status "FAIL" -Details ("Hash verification failed: {0} missing files, {1} hash mismatches." -f $missingFiles.Count, $hashMismatches.Count)
                        }
                    } else {
                        Record-Check -Name "Backup File Hash Verification" -Status "INCONCLUSIVE" -Details ("Manifest at '{0}' does not contain webNextFileCatalog property (actual files in web-next: {1})." -f $manifestPath, $actualCount)
                    }
                }
            } catch {
                Record-Check -Name "Backup Manifest Inspection" -Status "FAIL" -Details ("Error inspecting manifest '{0}': $($_.Exception.Message)" -f $manifestPath)
            }
        }
    }

    # 6. Displaced Artifact Retention Check (Single-object and Array safe)
    $webDir = Join-Path $RepoPath "apps\web"
    if (Test-Path -LiteralPath $webDir) {
        $displacedItems = @(Get-ChildItem -LiteralPath $webDir -Filter "*.displaced-*" -Directory -ErrorAction SilentlyContinue)
        if ($displacedItems.Count -gt 0) {
            $dispPaths = ($displacedItems | ForEach-Object { $_.FullName }) -join "; "
            Record-Check -Name "Displaced Artifact Retention" -Status "PASS" -Details ("Displaced build directory retained at '{0}' (safe; dormant)." -f $dispPaths)
        } else {
            Record-Check -Name "Displaced Artifact Retention" -Status "INFO" -Details "No active .displaced-* directory found in apps/web."
        }
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
