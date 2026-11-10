# RUN ON SERVER
# AHH WFM -- Commercial Duplicate Quotation Fix Guarded Recovery Script (PowerShell 5.1 Compatible)
# Restores apps/web/.next and Git HEAD back to VIBE-14 baseline (c44104ceb6f9a917454805f72c449e6fdbd808c3)
# Preserves branch 'manpower-operations-scope' without destructive hard-reset or forced checkout.
# Retains displaced build artifacts until post-recovery health checks pass.

param(
    [string]$BackupRoot = "",
    [string]$RepoPath = "D:\Apps\AHH-WFM\dev",
    [string]$BackupsParent = "D:\Apps\AHH-WFM\backups",
    [string]$NormalizerScriptPath = (Join-Path $PSScriptRoot "normalize-pm2-jlist.js")
)

& {
    $ErrorActionPreference = "Stop"
    Set-StrictMode -Version Latest

    function Invoke-NativeStep {
        param(
            [Parameter(Mandatory = $true)][string]$StepName,
            [Parameter(Mandatory = $true)][scriptblock]$Command
        )
        Write-Host "`n>>> [$StepName]" -ForegroundColor Yellow
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $Command
            $exitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $prevPref
        }
        if ($exitCode -ne 0) {
            throw "RECOVERY FAIL-FAST ABORT at [$StepName]: Command exited with code $exitCode."
        }
    }

    function Get-NormalizedPm2List {
        param([Parameter(Mandatory = $true)][string]$NormalizerPath)
        if (-not (Test-Path -LiteralPath $NormalizerPath)) {
            throw "RECOVERY ABORT: PM2 normalizer script not found at '$NormalizerPath'."
        }
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $rawPm2 = (pm2 jlist) -join "`n"
            $pm2Exit = $LASTEXITCODE
            if ($pm2Exit -ne 0) {
                throw "pm2 jlist exited with code $pm2Exit."
            }
            $normOut = $rawPm2 | node $NormalizerPath
            $nodeExit = $LASTEXITCODE
            if ($nodeExit -ne 0) {
                throw "normalize-pm2-jlist.js exited with code $nodeExit."
            }
        } finally {
            $ErrorActionPreference = $prevPref
        }
        return ,(($normOut -join "`n") | ConvertFrom-Json)
    }

    function Test-NextBuildDirectory {
        param([Parameter(Mandatory = $true)][string]$NextDirPath)
        $requiredFiles = @(
            (Join-Path $NextDirPath "BUILD_ID"),
            (Join-Path $NextDirPath "routes-manifest.json"),
            (Join-Path $NextDirPath "build-manifest.json")
        )
        foreach ($f in $requiredFiles) {
            if (-not (Test-Path -LiteralPath $f)) {
                return $false
            }
            if ((Get-Item -LiteralPath $f).Length -le 0) {
                return $false
            }
        }
        $appPathsManifest = Join-Path $NextDirPath "server\app-paths-manifest.json"
        $pagesManifest    = Join-Path $NextDirPath "server\pages-manifest.json"
        if (-not (Test-Path -LiteralPath $appPathsManifest) -and -not (Test-Path -LiteralPath $pagesManifest)) {
            return $false
        }
        return $true
    }

    function Verify-CompleteDirectoryCatalog {
        param(
            [Parameter(Mandatory = $true)][string]$DirectoryPath,
            [Parameter(Mandatory = $true)][psobject]$ExpectedCatalog
        )
        $resolvedRoot = (Resolve-Path -LiteralPath $DirectoryPath).Path.TrimEnd('\')
        $allFiles = [System.IO.Directory]::GetFiles($resolvedRoot, "*", [System.IO.SearchOption]::AllDirectories)
        $sha = [System.Security.Cryptography.SHA256]::Create()

        $props = @($ExpectedCatalog.PSObject.Properties)
        if ($allFiles.Count -ne $props.Count) {
            throw "RECOVERY ABORT: File count mismatch in '$DirectoryPath' (found $($allFiles.Count), expected $($props.Count))."
        }

        foreach ($prop in $props) {
            $relPath = $prop.Name
            $expectedHash = [string]$prop.Value
            $fullPath = Join-Path $resolvedRoot $relPath
            if (-not (Test-Path -LiteralPath $fullPath)) {
                throw "RECOVERY ABORT: Missing expected file '$relPath' in '$DirectoryPath'."
            }
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $actualHash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-'
            if ($actualHash -ne $expectedHash) {
                throw "RECOVERY ABORT: SHA-256 hash mismatch for '$relPath' in '$DirectoryPath'."
            }
        }
    }

    $ExpectedBranch     = "manpower-operations-scope"
    $BaselineSha        = "c44104ceb6f9a917454805f72c449e6fdbd808c3"
    $TargetSha          = "58405a429362500de875e4b20d5fe46abc5218dd"
    $AttemptPointerPath = Join-Path $BackupsParent "latest-dup-quot-deployment-attempt.json"

    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host " PHASE 1: RECOVERY PREFLIGHT & COMPLETE BACKUP VERIFICATION      " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow

    if (-not (Test-Path -LiteralPath $RepoPath)) {
        throw "RECOVERY ABORT: SERVER repository path '$RepoPath' does not exist."
    }
    Set-Location -LiteralPath $RepoPath

    if (-not (Test-Path -LiteralPath $AttemptPointerPath)) {
        if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
            throw "RECOVERY ABORT: Deployment attempt pointer '$AttemptPointerPath' not found and -BackupRoot not provided."
        }
    } else {
        $pointer = (Get-Content -LiteralPath $AttemptPointerPath -Raw) | ConvertFrom-Json
        if ([string]$pointer.baselineSha -ne $BaselineSha -or [string]$pointer.targetSha -ne $TargetSha) {
            throw "RECOVERY ABORT: Deployment attempt pointer SHA mismatch (baseline=$($pointer.baselineSha), target=$($pointer.targetSha))."
        }
        $resolvedFromPointer = [string]$pointer.backupRoot
        if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
            $BackupRoot = $resolvedFromPointer
        } elseif ($BackupRoot -ne $resolvedFromPointer) {
            throw "RECOVERY ABORT: Provided -BackupRoot '$BackupRoot' does not match active deployment attempt backup '$resolvedFromPointer'."
        }
    }

    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        throw "RECOVERY ABORT: Backup root directory '$BackupRoot' does not exist."
    }

    $manifestPath = Join-Path $BackupRoot "backup-manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        throw "RECOVERY ABORT: Backup manifest not found at '$manifestPath'."
    }
    $manifest = (Get-Content -LiteralPath $manifestPath -Raw) | ConvertFrom-Json

    if ([string]$manifest.baselineSha -ne $BaselineSha -or [string]$manifest.targetSha -ne $TargetSha) {
        throw "RECOVERY ABORT: Backup manifest SHA mismatch (baseline=$($manifest.baselineSha), target=$($manifest.targetSha))."
    }
    if (-not [bool]$manifest.isRollbackReady) {
        throw "RECOVERY ABORT: Backup manifest indicates backup is not certified rollback-ready."
    }

    $bakWebNext = Join-Path $BackupRoot "web-next"
    if (-not (Test-NextBuildDirectory -NextDirPath $bakWebNext)) {
        throw "RECOVERY ABORT: Backup Web directory '$bakWebNext' failed structural validation."
    }

    Write-Host "Verifying 100% SHA-256 file catalog of backup from: $BackupRoot..."
    $catalogSw = [System.Diagnostics.Stopwatch]::StartNew()
    Verify-CompleteDirectoryCatalog -DirectoryPath $bakWebNext -ExpectedCatalog $manifest.webNextFileCatalog
    $catalogSw.Stop()
    Write-Host ("100% backup integrity verified ({0} files) in {1} ms" -f $manifest.webNextFileCount, $catalogSw.ElapsedMilliseconds) -ForegroundColor Green

    $pm2Procs = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath
    $protectedWorkers = @(
        "ahh-wfm-manpower-reconciliation-worker-dev",
        "ahh-wfm-secfac-notification-worker-dev",
        "ahh-wfm-secfac-evaluation-worker-dev",
        "ahh-wfm-secfac-monitoring-worker-dev"
    )
    $baselineWorkerState   = @{}
    $baselineWorkerPid     = @{}
    $baselineWorkerRestart = @{}
    foreach ($wName in $protectedWorkers) {
        if ($null -ne $manifest.baselineWorkers -and $null -ne $manifest.baselineWorkers.$wName) {
            $baselineWorkerState[$wName]   = [string]$manifest.baselineWorkers.$wName.status
            $baselineWorkerPid[$wName]     = [int]$manifest.baselineWorkers.$wName.pid
            $baselineWorkerRestart[$wName] = [int]$manifest.baselineWorkers.$wName.restart_time
        } else {
            $proc = $pm2Procs | Where-Object { $_.name -eq $wName }
            $baselineWorkerState[$wName]   = if ($null -ne $proc) { [string]$proc.status } else { "absent" }
            $baselineWorkerPid[$wName]     = if ($null -ne $proc) { [int]$proc.pid } else { 0 }
            $baselineWorkerRestart[$wName] = if ($null -ne $proc) { [int]$proc.restart_time } else { 0 }
        }
    }

    if ($null -ne $manifest.baselineMobile) {
        $baselineMobileState   = [string]$manifest.baselineMobile.status
        $baselineMobilePid     = [int]$manifest.baselineMobile.pid
        $baselineMobileRestart = [int]$manifest.baselineMobile.restart_time
    } else {
        $mobileProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
        $baselineMobileState   = if ($null -ne $mobileProc) { [string]$mobileProc.status } else { "absent" }
        $baselineMobilePid     = if ($null -ne $mobileProc) { [int]$mobileProc.pid } else { 0 }
        $baselineMobileRestart = if ($null -ne $mobileProc) { [int]$mobileProc.restart_time } else { 0 }
    }

    Write-Host "`n=================================================================" -ForegroundColor Yellow
    Write-Host " PHASE 2: GUARDED GIT RESTORATION TO VIBE-14 BASELINE            " -ForegroundColor Yellow
    Write-Host " (Preserves branch 'manpower-operations-scope'; non-destructive) " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $preRecoverBranch = ((git branch --show-current) -join "").Trim()
    $preRecoverHead   = ((git rev-parse HEAD) -join "").Trim()
    $preRecoverStatus = ((git status --porcelain) -join "`n").Trim()
    $ErrorActionPreference = $prevPref

    if ($preRecoverBranch -ne $ExpectedBranch) {
        throw "RECOVERY ABORT: Expected branch '$ExpectedBranch', found '$preRecoverBranch'."
    }
    if ($preRecoverHead -ne $TargetSha -and $preRecoverHead -ne $BaselineSha) {
        throw "RECOVERY ABORT: Current HEAD '$preRecoverHead' is neither expected target '$TargetSha' nor baseline '$BaselineSha'."
    }
    if (-not [string]::IsNullOrWhiteSpace($preRecoverStatus)) {
        throw "RECOVERY ABORT: Cannot recover with uncommitted modifications:`n$preRecoverStatus"
    }

    Invoke-NativeStep -StepName "git reset --merge $BaselineSha" -Command {
        git reset --merge $BaselineSha
    }

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $restoredHead   = ((git rev-parse HEAD) -join "").Trim()
    $restoredBranch = ((git branch --show-current) -join "").Trim()
    $restoredStatus = ((git status --porcelain) -join "`n").Trim()
    $ErrorActionPreference = $prevPref

    if ($restoredHead -ne $BaselineSha) {
        throw "RECOVERY ABORT: Restored HEAD is '$restoredHead', expected '$BaselineSha'."
    }
    if ($restoredBranch -ne $ExpectedBranch) {
        throw "RECOVERY ABORT: Restored branch is '$restoredBranch', expected '$ExpectedBranch'."
    }
    if (-not [string]::IsNullOrWhiteSpace($restoredStatus)) {
        throw "RECOVERY ABORT: Working tree is dirty after reset: $restoredStatus"
    }
    Write-Host "Git HEAD safely restored to VIBE-14 baseline: $restoredHead (Branch '$restoredBranch' preserved)" -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Yellow
    Write-Host " PHASE 3: STAGED SWAP OF WEB BUILD & DISPLACED ARTIFACT RETENTION" -ForegroundColor Yellow
    Write-Host " (Workers & Mobile remain ONLINE throughout)                     " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow

    Invoke-NativeStep -StepName "pm2 stop ahh-wfm-web-dev" -Command {
        pm2 stop ahh-wfm-web-dev
    }
    Start-Sleep -Seconds 2

    $targetNextDir = Join-Path $RepoPath "apps\web\.next"
    $ts            = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $stageDir      = "$targetNextDir.restore-stage-$PID-$ts"
    $displacedDir  = "$targetNextDir.displaced-$PID-$ts"

    if (Test-Path -LiteralPath $stageDir) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force
    }
    Copy-Item -LiteralPath $bakWebNext -Destination $stageDir -Recurse -Force

    if (-not (Test-NextBuildDirectory -NextDirPath $stageDir)) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
        throw "RECOVERY ABORT: Staged Next.js directory '$stageDir' failed structural validation."
    }

    Write-Host "Verifying 100% SHA-256 integrity of staged directory '$stageDir'..."
    Verify-CompleteDirectoryCatalog -DirectoryPath $stageDir -ExpectedCatalog $manifest.webNextFileCatalog

    try {
        if (Test-Path -LiteralPath $targetNextDir) {
            [System.IO.Directory]::Move($targetNextDir, $displacedDir)
            Write-Host "Displaced live build artifacts retained at: $displacedDir" -ForegroundColor Yellow
        }
        [System.IO.Directory]::Move($stageDir, $targetNextDir)
    } catch {
        $errMsg = $_.Exception.Message
        if (-not (Test-Path -LiteralPath $targetNextDir) -and (Test-Path -LiteralPath $displacedDir)) {
            try { [System.IO.Directory]::Move($displacedDir, $targetNextDir) } catch {}
        }
        Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
        throw "RECOVERY ABORT: Atomic directory swap failed: $errMsg"
    }

    Write-Host "Verifying live restored directory '$targetNextDir'..."
    Verify-CompleteDirectoryCatalog -DirectoryPath $targetNextDir -ExpectedCatalog $manifest.webNextFileCatalog
    Write-Host "apps/web/.next restored via staged swap and verified (BUILD_ID: $($manifest.preWebBuildId))." -ForegroundColor Green

    Invoke-NativeStep -StepName "pm2 restart ahh-wfm-web-dev --update-env" -Command {
        pm2 restart ahh-wfm-web-dev --update-env
    }
    Start-Sleep -Seconds 5

    Write-Host "`n=================================================================" -ForegroundColor Yellow
    Write-Host " PHASE 4: POST-RECOVERY HEALTH, PRESERVATION & ARTIFACT ARCHIVAL " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow

    $pm2After = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath

    $pWeb = $pm2After | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
    if ($null -eq $pWeb -or [string]$pWeb.status -ne "online") {
        throw "RECOVERY ABORT: Web service is not online after recovery restart. Displaced artifacts retained at '$displacedDir'."
    }
    Write-Host ("Web Service [ahh-wfm-web-dev] : online (PID {0})" -f $pWeb.pid) -ForegroundColor Green

    $pMob = $pm2After | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
    $afterMobState   = if ($null -ne $pMob) { [string]$pMob.status } else { "absent" }
    $afterMobPid     = if ($null -ne $pMob) { [int]$pMob.pid } else { 0 }
    $afterMobRestart = if ($null -ne $pMob) { [int]$pMob.restart_time } else { 0 }
    if ($afterMobState -ne $baselineMobileState -or $afterMobPid -ne $baselineMobilePid -or $afterMobRestart -ne $baselineMobileRestart) {
        throw "RECOVERY ABORT: Mobile service was disturbed during recovery! Baseline PID=$baselineMobilePid (restarts=$baselineMobileRestart), After PID=$afterMobPid (restarts=$afterMobRestart)."
    }
    Write-Host ("Mobile Service [ahh-wfm-mobile-dev] : Preserved (PID {0}, restarts {1})" -f $afterMobPid, $afterMobRestart) -ForegroundColor Green

    foreach ($wName in $protectedWorkers) {
        $p = $pm2After | Where-Object { $_.name -eq $wName }
        $afterState   = if ($null -ne $p) { [string]$p.status } else { "absent" }
        $afterPid     = if ($null -ne $p) { [int]$p.pid } else { 0 }
        $afterRestart = if ($null -ne $p) { [int]$p.restart_time } else { 0 }
        if ($afterState -ne $baselineWorkerState[$wName] -or $afterPid -ne $baselineWorkerPid[$wName] -or $afterRestart -ne $baselineWorkerRestart[$wName]) {
            throw "RECOVERY ABORT: Protected worker '$wName' was disturbed during recovery! Baseline PID=$($baselineWorkerPid[$wName]), After PID=$afterPid."
        }
        Write-Host ("Protected Worker [{0}] : Preserved (status={1}, PID={2}, restarts={3})" -f $wName, $afterState, $afterPid, $afterRestart) -ForegroundColor Green
    }

    $reminderAfter = $pm2After | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
    $reminderAfterState = if ($null -ne $reminderAfter) { [string]$reminderAfter.status } else { "absent" }
    if ($reminderAfterState -eq "online") {
        throw "RECOVERY ABORT: Commercial Reminder Worker is online! It must remain stopped."
    }
    Write-Host "Commercial Reminder Worker : $reminderAfterState (Verified Stopped/Absent)" -ForegroundColor Green

    $loginEndpoints = @(
        "http://127.0.0.1:3200/login",
        "http://10.10.50.24:3200/login",
        "http://127.0.0.1:3201/login",
        "http://10.10.50.24:3201/login"
    )
    foreach ($u in $loginEndpoints) {
        $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15
        if ([int]$resp.StatusCode -ne 200) {
            throw "RECOVERY ABORT: Login smoke test failed for $u (HTTP $($resp.StatusCode)). Displaced artifacts retained at '$displacedDir'."
        }
        Write-Host ("Login Smoke Test {0} -> HTTP {1} (Verified)" -f $u, $resp.StatusCode) -ForegroundColor Green
    }

    if (Test-Path -LiteralPath $displacedDir) {
        $archiveTarget = Join-Path $BackupRoot "displaced-web-next-$ts"
        try {
            [System.IO.Directory]::Move($displacedDir, $archiveTarget)
            Write-Host "Displaced build artifacts archived after health check success: $archiveTarget" -ForegroundColor Green
        } catch {
            try {
                Copy-Item -LiteralPath $displacedDir -Destination $archiveTarget -Recurse -Force
                Remove-Item -LiteralPath $displacedDir -Recurse -Force
                Write-Host "Displaced build artifacts archived via copy/remove: $archiveTarget" -ForegroundColor Green
            } catch {
                Write-Host "Displaced build artifacts retained at: $displacedDir" -ForegroundColor Yellow
            }
        }
    }

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " GUARDED RECOVERY COMPLETED & VERIFIED AT BASELINE: $restoredHead" -ForegroundColor Green
    Write-Host " Restored from Backup : $BackupRoot                              " -ForegroundColor Green
    Write-Host " Branch Preserved     : $restoredBranch                          " -ForegroundColor Green
    Write-Host " Web BUILD_ID         : $($manifest.preWebBuildId)               " -ForegroundColor Green
    Write-Host " Mobile & Workers     : 100% Preserved (Unchanged PIDs & Restarts)" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
