# RUN ON SERVER
# AHH WFM -- Commercial Duplicate Quotation Post-Deployment Read-Only Verification Script (PowerShell 5.1 Compatible)
# Target SHA   : 58405a429362500de875e4b20d5fe46abc5218dd
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
    $ExpectedHead   = "58405a429362500de875e4b20d5fe46abc5218dd"
    $ForbiddenP0Sha = "cb35ce886b17b43d20da164171373f706214dddd"

    $results = [ordered]@{}
    $failures = New-Object System.Collections.Generic.List[string]
    $inconclusive = New-Object System.Collections.Generic.List[string]

    function Record-Check {
        param(
            [string]$Name,
            [string]$Status,
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
    Write-Host " DUPLICATE QUOTATION POST-DEPLOYMENT READ-ONLY VERIFICATION AUDIT" -ForegroundColor Cyan
    Write-Host " Target Commit: $ExpectedHead                                    " -ForegroundColor Cyan
    Write-Host " Target Branch: $ExpectedBranch                                  " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

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
            Record-Check -Name "Git HEAD" -Status "PASS" -Details "HEAD is exact target '$curHead'."
        } else {
            Record-Check -Name "Git HEAD" -Status "FAIL" -Details "Expected HEAD '$ExpectedHead', found '$curHead'."
        }

        git merge-base --is-ancestor $ForbiddenP0Sha $curHead 2>$null
        if ($LASTEXITCODE -eq 0) {
            Record-Check -Name "UM-RBAC-1 P0 Exclusion" -Status "FAIL" -Details "Forbidden P0 commit '$ForbiddenP0Sha' is an ancestor of HEAD!"
        } else {
            Record-Check -Name "UM-RBAC-1 P0 Exclusion" -Status "PASS" -Details "Forbidden P0 commit '$ForbiddenP0Sha' is excluded."
        }

        $worktreeLines = @(git status --porcelain)
        $worktreeJoined = ($worktreeLines -join "`n").Trim()
        if ([string]::IsNullOrWhiteSpace($worktreeJoined)) {
            Record-Check -Name "Working Tree" -Status "PASS" -Details "Working tree is clean."
        } else {
            Record-Check -Name "Working Tree" -Status "FAIL" -Details "Working tree is dirty:`n$worktreeJoined"
        }
    }

    foreach ($u in @("http://127.0.0.1:3200/login", "http://10.10.50.24:3200/login")) {
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

    foreach ($u in @("http://127.0.0.1:3201/login", "http://10.10.50.24:3201/login")) {
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

    # Resolve deployment attempt pointer & baseline manifest for PM2 + backup verification
    $resolvedBackupRoot = ""
    $pointerFile = Join-Path $BackupsParent "latest-dup-quot-deployment-attempt.json"
    $ptrObj = $null
    $manifestObj = $null

    if (-not [string]::IsNullOrWhiteSpace($BackupRoot)) {
        $resolvedBackupRoot = $BackupRoot
    } elseif (Test-Path -LiteralPath $pointerFile) {
        try {
            $ptrObj = (Get-Content -LiteralPath $pointerFile -Raw) | ConvertFrom-Json
            $ptrRoot = Get-SafeProperty $ptrObj "backupRoot"
            if (-not [string]::IsNullOrWhiteSpace([string]$ptrRoot)) {
                $resolvedBackupRoot = [string]$ptrRoot
                Record-Check -Name "Attempt Pointer Resolution" -Status "PASS" -Details ("Resolved backupRoot '{0}' from attempt pointer." -f $resolvedBackupRoot)
            }
        } catch {
            Record-Check -Name "Attempt Pointer Resolution" -Status "FAIL" -Details ("Failed to parse attempt pointer '{0}': $($_.Exception.Message)" -f $pointerFile)
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolvedBackupRoot) -and (Test-Path -LiteralPath $BackupsParent)) {
        $candidates = @(Get-ChildItem -LiteralPath $BackupsParent -Filter "pre-deploy-dup-quot-*" -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
        if ($candidates.Count -gt 0) {
            $resolvedBackupRoot = $candidates[0].FullName
            Record-Check -Name "Backup Fallback Resolution" -Status "INFO" -Details ("Resolved newest matching backup '{0}'." -f $resolvedBackupRoot)
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($resolvedBackupRoot)) {
        $mPath = Join-Path $resolvedBackupRoot "backup-manifest.json"
        if (Test-Path -LiteralPath $mPath) {
            try {
                $manifestObj = (Get-Content -LiteralPath $mPath -Raw) | ConvertFrom-Json
            } catch {}
        }
    }

    $pm2Procs = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath
    if ($null -eq $pm2Procs) {
        Record-Check -Name "PM2 Process Inspection" -Status "FAIL" -Details "Could not query or normalize PM2 process list."
    } else {
        $pWeb = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
        if ($null -ne $pWeb -and [string]$pWeb.status -eq "online") {
            Record-Check -Name "Web PM2 Service" -Status "PASS" -Details "Status 'online' (PID $($pWeb.pid), Restarts $($pWeb.restart_time))."
        } else {
            $st = if ($null -ne $pWeb) { [string]$pWeb.status } else { "absent" }
            Record-Check -Name "Web PM2 Service" -Status "FAIL" -Details "Status is '$st' (expected 'online')."
        }

        $pMob = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
        if ($null -ne $pMob -and [string]$pMob.status -eq "online") {
            $baseMob = Get-SafeProperty $manifestObj "baselineMobile"
            if ($null -ne $baseMob) {
                $expMobPid = [int](Get-SafeProperty $baseMob "pid" 0)
                $expMobRst = [int](Get-SafeProperty $baseMob "restart_time" -1)
                if ([int]$pMob.pid -eq $expMobPid -and [int]$pMob.restart_time -eq $expMobRst) {
                    Record-Check -Name "Mobile PM2 Preservation" -Status "PASS" -Details ("Status 'online', PID {0}, restarts {1} match baseline manifest." -f $pMob.pid, $pMob.restart_time)
                } else {
                    Record-Check -Name "Mobile PM2 Preservation" -Status "FAIL" -Details ("Mobile changed! Current PID=$($pMob.pid) restarts=$($pMob.restart_time); Baseline PID=$expMobPid restarts=$expMobRst.")
                }
            } else {
                Record-Check -Name "Mobile PM2 Service" -Status "PASS" -Details "Status 'online' (PID $($pMob.pid), Restarts $($pMob.restart_time))."
            }
        } else {
            $st = if ($null -ne $pMob) { [string]$pMob.status } else { "absent" }
            Record-Check -Name "Mobile PM2 Service" -Status "FAIL" -Details "Status is '$st' (expected 'online')."
        }

        $pRem = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
        if ($null -eq $pRem -or [string]$pRem.status -ne "online") {
            $remSt = if ($null -ne $pRem) { [string]$pRem.status } else { "absent" }
            Record-Check -Name "Commercial Reminder Worker" -Status "PASS" -Details "Status is '$remSt' (verified stopped/absent)."
        } else {
            Record-Check -Name "Commercial Reminder Worker" -Status "FAIL" -Details "Unexpectedly online! Must remain stopped."
        }

        $protectedWorkers = @(
            "ahh-wfm-manpower-reconciliation-worker-dev",
            "ahh-wfm-secfac-notification-worker-dev",
            "ahh-wfm-secfac-evaluation-worker-dev",
            "ahh-wfm-secfac-monitoring-worker-dev"
        )
        $baselineWorkers = Get-SafeProperty $manifestObj "baselineWorkers"

        foreach ($wName in $protectedWorkers) {
            $p = $pm2Procs | Where-Object { $_.name -eq $wName }
            $wStatus  = if ($null -ne $p) { [string]$p.status } else { "absent" }
            $wPid     = if ($null -ne $p) { [int]$p.pid } else { 0 }
            $wRestart = if ($null -ne $p) { [int]$p.restart_time } else { 0 }

            if ($wStatus -ne "online") {
                Record-Check -Name "Worker Status ($wName)" -Status "FAIL" -Details "Status is '$wStatus' (expected 'online')."
                continue
            }

            $workerManifest = Get-SafeProperty $baselineWorkers $wName
            if ($null -ne $workerManifest) {
                $expPid = [int](Get-SafeProperty $workerManifest "pid" 0)
                $expRst = [int](Get-SafeProperty $workerManifest "restart_time" -1)
                if ($wPid -eq $expPid -and $wRestart -eq $expRst) {
                    Record-Check -Name "Worker Preservation ($wName)" -Status "PASS" -Details ("Status 'online', PID {0}, restarts {1} match baseline manifest." -f $wPid, $wRestart)
                } else {
                    Record-Check -Name "Worker Preservation ($wName)" -Status "FAIL" -Details ("Worker changed! Current PID=$wPid restarts=$wRestart; Baseline PID=$expPid restarts=$expRst.")
                }
            } else {
                Record-Check -Name "Worker Preservation ($wName)" -Status "INCONCLUSIVE" -Details ("Online (PID=$wPid, restarts=$wRestart) but no baseline manifest available.")
            }
        }
    }

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

    if (-not [string]::IsNullOrWhiteSpace($resolvedBackupRoot) -and $null -ne $manifestObj) {
        $webNextBak = Join-Path $resolvedBackupRoot "web-next"
        if (-not (Test-Path -LiteralPath $webNextBak)) {
            Record-Check -Name "Backup Web Directory" -Status "FAIL" -Details "Backup 'web-next' not found at '$webNextBak'."
        } else {
            $resolvedWebNextRoot = (Resolve-Path -LiteralPath $webNextBak).Path.TrimEnd('\')
            $actualFiles = [System.IO.Directory]::GetFiles($resolvedWebNextRoot, "*", [System.IO.SearchOption]::AllDirectories)
            $expectedCatalog = Get-SafeProperty $manifestObj "webNextFileCatalog"
            if ($null -ne $expectedCatalog) {
                $expectedProps = @($expectedCatalog.PSObject.Properties)
                if ($actualFiles.Count -ne $expectedProps.Count) {
                    Record-Check -Name "Backup File Inventory Count" -Status "FAIL" -Details ("Actual count ({0}) != manifest ({1})." -f $actualFiles.Count, $expectedProps.Count)
                } else {
                    $sha = [System.Security.Cryptography.SHA256]::Create()
                    $mismatches = 0; $missing = 0
                    foreach ($prop in $expectedProps) {
                        $fullPath = Join-Path $resolvedWebNextRoot $prop.Name
                        if (-not (Test-Path -LiteralPath $fullPath)) { $missing++; continue }
                        $actualHash = [System.BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($fullPath))) -replace '-'
                        if ($actualHash -ne [string]$prop.Value) { $mismatches++ }
                    }
                    if ($missing -eq 0 -and $mismatches -eq 0) {
                        Record-Check -Name "Backup File Hash Verification" -Status "PASS" -Details ("100% SHA-256 match verified across all {0} backup files." -f $expectedProps.Count)
                    } else {
                        Record-Check -Name "Backup File Hash Verification" -Status "FAIL" -Details ("Missing=$missing, Mismatches=$mismatches")
                    }
                }
            }
        }
    } else {
        Record-Check -Name "Backup Verification" -Status "INCONCLUSIVE" -Details "No backup manifest located."
    }

    $webDir = Join-Path $RepoPath "apps\web"
    if (Test-Path -LiteralPath $webDir) {
        $displacedItems = @(Get-ChildItem -LiteralPath $webDir -Filter "*.displaced-*" -Directory -ErrorAction SilentlyContinue)
        if ($displacedItems.Count -gt 0) {
            Record-Check -Name "Displaced Artifact Retention" -Status "PASS" -Details ("Retained at: {0}" -f (($displacedItems | ForEach-Object { $_.FullName }) -join "; "))
        } else {
            Record-Check -Name "Displaced Artifact Retention" -Status "INFO" -Details "No active .displaced-* directory in apps/web."
        }
    }

    $finalVerdict = "PASS"
    if ($failures.Count -gt 0) { $finalVerdict = "FAIL" }
    elseif ($inconclusive.Count -gt 0) { $finalVerdict = "INCONCLUSIVE" }

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " FINAL POST-DEPLOYMENT VERIFICATION VERDICT: $finalVerdict" -ForegroundColor $(if ($finalVerdict -eq "PASS") { "Green" } elseif ($finalVerdict -eq "FAIL") { "Red" } else { "Yellow" })
    Write-Host "=================================================================" -ForegroundColor Cyan
    if ($failures.Count -gt 0) {
        foreach ($f in $failures) { Write-Host "  FAIL: $f" -ForegroundColor Red }
        exit 1
    }
}
