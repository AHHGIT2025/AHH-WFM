# RUN ON SERVER
# AHH WFM — VIBE-14 V3 Pinned SERVER Deployment Script (PowerShell 5.1 Compatible)
# Baseline SHA : 4967e95fa779b81f8fa1ce5ce1c419412ff8f1ef (VIBE-13 Deployed Baseline)
# Target SHA   : c44104ceb6f9a917454805f72c449e6fdbd808c3 (Pinned VIBE-14 Isolated Hotfix)
# Forbidden P0 : cb35ce886b17b43d20da164171373f706214dddd (Undeployed P0; must NEVER be deployed)
# Branch       : manpower-operations-scope (Preserved throughout)

param(
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
        Write-Host "`n>>> [$StepName]" -ForegroundColor Cyan
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $Command
            $exitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $prevPref
        }
        if ($exitCode -ne 0) {
            throw "FAIL-FAST ABORT at [$StepName]: Command exited with code $exitCode."
        }
    }

    function Get-NormalizedPm2List {
        param([Parameter(Mandatory = $true)][string]$NormalizerPath)
        if (-not (Test-Path -LiteralPath $NormalizerPath)) {
            throw "NO-GO ABORT: PM2 normalizer script not found at '$NormalizerPath'."
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

    function Get-CompleteDirectoryCatalog {
        param([Parameter(Mandatory = $true)][string]$DirectoryPath)
        $resolvedRoot = (Resolve-Path -LiteralPath $DirectoryPath).Path.TrimEnd('\')
        $allFiles = [System.IO.Directory]::GetFiles($resolvedRoot, "*", [System.IO.SearchOption]::AllDirectories)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $catalog = [ordered]@{}
        foreach ($filePath in $allFiles) {
            $relPath = $filePath.Substring($resolvedRoot.Length + 1)
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $hashHex = [System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-'
            $catalog[$relPath] = $hashHex
        }
        return $catalog
    }

    $ExpectedBranch     = "manpower-operations-scope"
    $ExpectedOrigin     = "https://github.com/AHHGIT2025/AHH-WFM.git"
    $BaselineSha        = "4967e95fa779b81f8fa1ce5ce1c419412ff8f1ef"
    $TargetSha          = "c44104ceb6f9a917454805f72c449e6fdbd808c3"
    $ForbiddenP0Sha     = "cb35ce886b17b43d20da164171373f706214dddd"
    $HotfixBranch       = "hotfix/vibe-14-commercial-proposal"
    $Timestamp          = Get-Date -Format "yyyyMMdd-HHmmss"
    $DeploymentId       = "deploy-vibe14-v3-$TargetSha-$Timestamp"
    $BackupRoot         = Join-Path $BackupsParent "pre-deploy-vibe14-$TargetSha-$Timestamp"
    $AttemptPointerPath = Join-Path $BackupsParent "latest-vibe14-deployment-attempt.json"

    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 1: READ-ONLY SERVER PREFLIGHT & WORKER PROTECTION CHECK   " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    if (-not (Test-Path -LiteralPath $RepoPath)) {
        throw "NO-GO ABORT: SERVER repository path '$RepoPath' does not exist."
    }
    Set-Location -LiteralPath $RepoPath

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $currentOrigin       = ((git remote get-url origin) -join "").Trim()
    $originExit          = $LASTEXITCODE
    $currentHead         = ((git rev-parse HEAD) -join "").Trim()
    $headExit            = $LASTEXITCODE
    $currentBranch       = ((git branch --show-current) -join "").Trim()
    $branchExit          = $LASTEXITCODE
    $worktreeLines       = @(git status --porcelain)
    $statusExit          = $LASTEXITCODE
    $ErrorActionPreference = $prevPref

    if ($originExit -ne 0 -or $headExit -ne 0 -or $branchExit -ne 0 -or $statusExit -ne 0) {
        throw "NO-GO ABORT: Preflight Git inspection failed."
    }

    $pm2Procs = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath

    Write-Host "Deployment ID       : $DeploymentId"
    Write-Host "Repository Path     : $RepoPath"
    Write-Host "Active Branch       : $currentBranch"
    Write-Host "Origin Remote       : $currentOrigin"
    Write-Host "Current HEAD        : $currentHead"
    Write-Host "Required Base (V13) : $BaselineSha"
    Write-Host "Pinned Target (V14) : $TargetSha"
    Write-Host "Backup Path         : $BackupRoot"

    if ($currentBranch -ne $ExpectedBranch) {
        throw "NO-GO ABORT: Expected branch '$ExpectedBranch', found '$currentBranch'."
    }
    if ($currentOrigin -ne $ExpectedOrigin) {
        throw "NO-GO ABORT: Expected origin '$ExpectedOrigin', found '$currentOrigin'."
    }
    if ($currentHead -ne $BaselineSha) {
        throw "NO-GO ABORT: Expected current SERVER HEAD '$BaselineSha' (VIBE-13), found '$currentHead'."
    }
    $worktreeJoined = ($worktreeLines -join "`n").Trim()
    if (-not [string]::IsNullOrWhiteSpace($worktreeJoined)) {
        throw "NO-GO ABORT: Working tree is not clean:`n$worktreeJoined"
    }

    # Record baseline state, PID, and restart counters for all services
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
        $proc = $pm2Procs | Where-Object { $_.name -eq $wName }
        $state   = if ($null -ne $proc) { [string]$proc.status } else { "absent" }
        $wPid    = if ($null -ne $proc) { [int]$proc.pid } else { 0 }
        $restart = if ($null -ne $proc) { [int]$proc.restart_time } else { 0 }
        $baselineWorkerState[$wName]   = $state
        $baselineWorkerPid[$wName]     = $wPid
        $baselineWorkerRestart[$wName] = $restart
        Write-Host ("Protected Worker [{0}] : status={1}, pid={2}, restarts={3}" -f $wName, $state, $wPid, $restart)
        if ($state -ne "online") {
            throw "NO-GO ABORT: Protected worker '$wName' is not online ($state)."
        }
    }

    # Verify Mobile PM2 is online and record baseline
    $mobileProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
    $baselineMobileState   = if ($null -ne $mobileProc) { [string]$mobileProc.status } else { "absent" }
    $baselineMobilePid     = if ($null -ne $mobileProc) { [int]$mobileProc.pid } else { 0 }
    $baselineMobileRestart = if ($null -ne $mobileProc) { [int]$mobileProc.restart_time } else { 0 }
    Write-Host ("Mobile Service   [ahh-wfm-mobile-dev] : status={0}, pid={1}, restarts={2}" -f $baselineMobileState, $baselineMobilePid, $baselineMobileRestart)
    if ($baselineMobileState -ne "online") {
        throw "NO-GO ABORT: Mobile service 'ahh-wfm-mobile-dev' is not online ($baselineMobileState)."
    }

    # Verify Web PM2 is online
    $webProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
    $baselineWebState = if ($null -ne $webProc) { [string]$webProc.status } else { "absent" }
    Write-Host ("Web Service      [ahh-wfm-web-dev] : status={0}" -f $baselineWebState)
    if ($baselineWebState -ne "online") {
        throw "NO-GO ABORT: Web service 'ahh-wfm-web-dev' is not online ($baselineWebState)."
    }

    # Verify Commercial Reminder Worker is NOT running
    $reminderProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
    $reminderState = if ($null -ne $reminderProc) { [string]$reminderProc.status } else { "absent" }
    if ($reminderState -eq "online") {
        throw "NO-GO ABORT: 'ahh-wfm-commercial-reminder-worker-dev' is online. It must remain stopped."
    }
    Write-Host "Commercial Reminder Worker : $reminderState (OK - Stopped/Absent)"

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 2: COMPLETE .NEXT BACKUP & 100% FILE INTEGRITY HASHING    " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $webNextPath = Join-Path $RepoPath "apps\web\.next"
    if (-not (Test-NextBuildDirectory -NextDirPath $webNextPath)) {
        throw "NO-GO ABORT: Pre-deploy Web build directory '$webNextPath' is invalid or missing required manifest files."
    }

    $webBuildIdFile     = Get-Item -LiteralPath (Join-Path $webNextPath "BUILD_ID")
    $preWebBuildId      = (Get-Content -LiteralPath $webBuildIdFile.FullName -Raw).Trim()
    $preWebBuildTimeUtc = $webBuildIdFile.LastWriteTimeUtc
    Write-Host ("Pre-Deploy Web BUILD_ID : {0} (LastModified: {1})" -f $preWebBuildId, $webBuildIdFile.LastWriteTime)

    # Compute complete 100% SHA-256 file catalog for all files in .next
    Write-Host "Cataloging and computing SHA-256 for all files in '$webNextPath'..."
    $catalogSw = [System.Diagnostics.Stopwatch]::StartNew()
    $srcCatalog = Get-CompleteDirectoryCatalog -DirectoryPath $webNextPath
    $catalogSw.Stop()
    Write-Host ("Cataloged {0} files with SHA-256 in {1} ms" -f $srcCatalog.Count, $catalogSw.ElapsedMilliseconds)

    if (-not (Test-Path -LiteralPath $BackupsParent)) {
        New-Item -ItemType Directory -Path $BackupsParent -Force | Out-Null
    }
    if (Test-Path -LiteralPath $BackupRoot) {
        throw "NO-GO ABORT: Timestamped backup directory '$BackupRoot' already exists. Never overwrite backups."
    }
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

    Copy-Item -LiteralPath (Join-Path $RepoPath "package.json") -Destination (Join-Path $BackupRoot "package.json.bak") -Force
    Copy-Item -LiteralPath $webNextPath -Destination (Join-Path $BackupRoot "web-next") -Recurse -Force

    $bakWebNext = Join-Path $BackupRoot "web-next"
    if (-not (Test-NextBuildDirectory -NextDirPath $bakWebNext)) {
        throw "NO-GO ABORT: Backup validation failed for '$bakWebNext'."
    }

    # Verify 100% of files in backup match source catalog
    Write-Host "Verifying complete 100% file integrity in backup directory '$bakWebNext'..."
    $bakCatalog = Get-CompleteDirectoryCatalog -DirectoryPath $bakWebNext
    if ($bakCatalog.Count -ne $srcCatalog.Count) {
        throw "NO-GO ABORT: Backup file count mismatch (source=$($srcCatalog.Count), backup=$($bakCatalog.Count))."
    }

    foreach ($entry in $srcCatalog.GetEnumerator()) {
        $relPath = $entry.Key
        $expectedHash = $entry.Value
        if (-not $bakCatalog.Contains($relPath)) {
            throw "NO-GO ABORT: Missing file '$relPath' in backup '$bakWebNext'."
        }
        if ($bakCatalog[$relPath] -ne $expectedHash) {
            throw "NO-GO ABORT: SHA-256 mismatch for backup file '$relPath'."
        }
    }
    Write-Host ("100% file integrity verified across all {0} backup files." -f $srcCatalog.Count) -ForegroundColor Green

    $manifestFile = Join-Path $BackupRoot "backup-manifest.json"
    $manifestObj = [ordered]@{
        deploymentId          = $DeploymentId
        createdAt             = (Get-Date).ToString("o")
        baselineSha           = $BaselineSha
        targetSha             = $TargetSha
        branch                = $ExpectedBranch
        backupRoot            = $BackupRoot
        preWebBuildId         = $preWebBuildId
        preWebBuildTimeUtc    = $preWebBuildTimeUtc.ToString("o")
        isRollbackReady       = $true
        webNextFileCount      = $srcCatalog.Count
        webNextFileCatalog    = $srcCatalog
    }
    ($manifestObj | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $manifestFile -Encoding UTF8
    if (-not (Test-Path -LiteralPath $manifestFile)) {
        throw "NO-GO ABORT: Failed to write '$manifestFile'."
    }

    $pointerObj = [ordered]@{
        deploymentId          = $DeploymentId
        createdAt             = $manifestObj.createdAt
        baselineSha           = $BaselineSha
        targetSha             = $TargetSha
        branch                = $ExpectedBranch
        backupRoot            = $BackupRoot
        manifestPath          = $manifestFile
        webNextFileCount      = $srcCatalog.Count
    }
    ($pointerObj | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $AttemptPointerPath -Encoding UTF8
    if (-not (Test-Path -LiteralPath $AttemptPointerPath)) {
        throw "NO-GO ABORT: Failed to write attempt pointer '$AttemptPointerPath'."
    }
    Write-Host "Complete backup registered and locked in $BackupRoot" -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 3: FETCH, ANCESTRY GATES, 13-FILE DIFF & FAST-FORWARD     " -ForegroundColor Cyan
    Write-Host " (Preserves branch 'manpower-operations-scope' without checkout) " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    Invoke-NativeStep -StepName "git fetch origin $HotfixBranch" -Command {
        git fetch origin $HotfixBranch
    }

    # Gate 3.1: Verify target commit exists in local git repository
    Invoke-NativeStep -StepName "Verify target commit exists ($TargetSha)" -Command {
        git cat-file -e "$TargetSha^{commit}"
    }

    # Gate 3.2: Verify baseline -> target ancestry
    Invoke-NativeStep -StepName "Verify baseline -> target ancestry ($BaselineSha -> $TargetSha)" -Command {
        git merge-base --is-ancestor $BaselineSha $TargetSha
    }

    # Gate 3.3: Verify target commit is on the fetched hotfix branch
    Invoke-NativeStep -StepName "Verify target commit is in origin/$HotfixBranch" -Command {
        git merge-base --is-ancestor $TargetSha "origin/$HotfixBranch"
    }

    # Gate 3.4: Verify exact 13-file diff between baseline and target
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $diffFiles = @(git diff --name-only $BaselineSha $TargetSha)
    $diffExit  = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    if ($diffExit -ne 0) {
        throw "NO-GO ABORT: git diff --name-only failed."
    }

    $expectedFiles = @(
        "apps/web/app/api/v1/commercial/costing/[id]/route.ts",
        "apps/web/app/api/v1/commercial/costing/[id]/workflow/route.ts",
        "apps/web/app/api/v1/commercial/costing/route.ts",
        "apps/web/app/api/v1/commercial/opportunities/route.ts",
        "apps/web/app/api/v1/commercial/proposals/[id]/route.ts",
        "apps/web/app/api/v1/commercial/proposals/route.ts",
        "apps/web/app/commercial/costing/page.tsx",
        "apps/web/app/commercial/opportunities/page.tsx",
        "apps/web/app/commercial/proposals/[id]/page.tsx",
        "apps/web/app/commercial/quotations/page.tsx",
        "docs/testing/CL-UAT-TESTER-1-SECURITY-GUARDING.md",
        "docs/testing/CL-UAT-TESTER-2-SECURITY-GUARDING.md",
        "tests/api/cl3-precontract-costing.spec.ts"
    )
    $diffMismatch = Compare-Object -ReferenceObject $expectedFiles -DifferenceObject $diffFiles
    if ($null -ne $diffMismatch) {
        throw "NO-GO ABORT: Release diff mismatch between $BaselineSha and $TargetSha. Found: $($diffFiles -join ', ')"
    }
    Write-Host "Verified exact 13-file VIBE-14 release diff (0 unexpected modifications):" -ForegroundColor Green
    $diffFiles | ForEach-Object { Write-Host "  - $_" }

    # Gate 3.5: Fast-forward merge directly into active branch (manpower-operations-scope preserved)
    Invoke-NativeStep -StepName "git merge --ff-only $TargetSha" -Command {
        git merge --ff-only $TargetSha
    }

    # Gate 3.6: Verify post-merge HEAD equals $TargetSha, branch is preserved, and did NOT advance to P0
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $deployedHead   = ((git rev-parse HEAD) -join "").Trim()
    $deployedBranch = ((git branch --show-current) -join "").Trim()
    $ErrorActionPreference = $prevPref

    if ($deployedHead -eq $ForbiddenP0Sha) {
        throw "CRITICAL ABORT: SERVER HEAD advanced to P0 commit '$ForbiddenP0Sha' instead of VIBE-14 '$TargetSha'!"
    }
    if ($deployedHead -ne $TargetSha) {
        throw "ABORT: Post-merge HEAD is '$deployedHead', expected '$TargetSha'."
    }
    if ($deployedBranch -ne $ExpectedBranch) {
        throw "ABORT: SERVER branch was unexpectedly changed to '$deployedBranch', expected '$ExpectedBranch'."
    }
    Write-Host "SERVER branch '$deployedBranch' strictly preserved and fast-forwarded to: $deployedHead" -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 4: WEB MAINTENANCE WINDOW & FRESH PRODUCTION BUILD        " -ForegroundColor Cyan
    Write-Host " (Workers & Mobile remain ONLINE; DB migrations NOT executed)    " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $buildStartTimeUtc = (Get-Date).ToUniversalTime()

    # Stop ONLY Web process for maintenance window
    Invoke-NativeStep -StepName "pm2 stop ahh-wfm-web-dev" -Command {
        pm2 stop ahh-wfm-web-dev
    }

    Start-Sleep -Seconds 2

    # Validate Prisma schema (sanity check only; no db pull/push/deploy!)
    Invoke-NativeStep -StepName "prisma validate" -Command {
        npx.cmd prisma validate --schema packages/database/prisma/schema.prisma
    }

    # Build Web only
    Invoke-NativeStep -StepName "npm run build --workspace=apps/web" -Command {
        npm.cmd run build --workspace=apps/web
    }
    if (-not (Test-NextBuildDirectory -NextDirPath $webNextPath)) {
        throw "ABORT: apps/web/.next failed post-build validation."
    }

    $newWebBuildIdFile = Get-Item -LiteralPath (Join-Path $webNextPath "BUILD_ID")
    $newWebBuildId     = (Get-Content -LiteralPath $newWebBuildIdFile.FullName -Raw).Trim()

    Write-Host "`nPost-Build Artifact Verification:" -ForegroundColor Cyan
    Write-Host ("  - Web BUILD_ID : {0} -> {1} (Modified: {2})" -f $preWebBuildId, $newWebBuildId, $newWebBuildIdFile.LastWriteTime)

    if ($newWebBuildIdFile.LastWriteTimeUtc -le $preWebBuildTimeUtc -or $newWebBuildIdFile.LastWriteTimeUtc -lt $buildStartTimeUtc.AddSeconds(-5)) {
        throw "ABORT: apps/web/.next/BUILD_ID timestamp was not updated by build."
    }
    Write-Host "Verified fresh Web production build." -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 5: RESTART WEB SERVICE ONLY                               " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    Invoke-NativeStep -StepName "pm2 restart ahh-wfm-web-dev --update-env" -Command {
        pm2 restart ahh-wfm-web-dev --update-env
    }

    Start-Sleep -Seconds 5

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 6: POST-DEPLOYMENT SMOKE, AUTH & WORKER PID PRESERVATION  " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $pm2After = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath

    # 1. Verify Web is online
    $pWeb = $pm2After | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
    if ($null -eq $pWeb -or [string]$pWeb.status -ne "online") {
        throw "ABORT: Web service 'ahh-wfm-web-dev' is not online after restart."
    }
    Write-Host ("Web Service [ahh-wfm-web-dev] : online (PID {0})" -f $pWeb.pid) -ForegroundColor Green

    # 2. Verify Mobile is untouched: online, identical PID, identical restart count
    $pMob = $pm2After | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
    $afterMobState   = if ($null -ne $pMob) { [string]$pMob.status } else { "absent" }
    $afterMobPid     = if ($null -ne $pMob) { [int]$pMob.pid } else { 0 }
    $afterMobRestart = if ($null -ne $pMob) { [int]$pMob.restart_time } else { 0 }
    if ($afterMobState -ne $baselineMobileState -or $afterMobPid -ne $baselineMobilePid -or $afterMobRestart -ne $baselineMobileRestart) {
        throw "ABORT: Mobile service was disturbed! Baseline PID=$baselineMobilePid (restarts=$baselineMobileRestart), After PID=$afterMobPid (restarts=$afterMobRestart)."
    }
    Write-Host ("Mobile Service [ahh-wfm-mobile-dev] : Preserved (PID {0}, restarts {1})" -f $afterMobPid, $afterMobRestart) -ForegroundColor Green

    # 3. Verify all 4 protected workers are untouched: online, identical PID, identical restart count
    foreach ($wName in $protectedWorkers) {
        $p = $pm2After | Where-Object { $_.name -eq $wName }
        $afterState   = if ($null -ne $p) { [string]$p.status } else { "absent" }
        $afterPid     = if ($null -ne $p) { [int]$p.pid } else { 0 }
        $afterRestart = if ($null -ne $p) { [int]$p.restart_time } else { 0 }
        if ($afterState -ne $baselineWorkerState[$wName] -or $afterPid -ne $baselineWorkerPid[$wName] -or $afterRestart -ne $baselineWorkerRestart[$wName]) {
            throw "ABORT: Protected worker '$wName' was disturbed! Baseline PID=$($baselineWorkerPid[$wName]) (restarts=$($baselineWorkerRestart[$wName])), After PID=$afterPid (restarts=$afterRestart)."
        }
        Write-Host ("Protected Worker [{0}] : Preserved (status={1}, PID={2}, restarts={3})" -f $wName, $afterState, $afterPid, $afterRestart) -ForegroundColor Green
    }

    # 4. Verify Commercial Reminder Worker remains stopped/absent
    $reminderAfter = $pm2After | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
    $reminderAfterState = if ($null -ne $reminderAfter) { [string]$reminderAfter.status } else { "absent" }
    if ($reminderAfterState -eq "online") {
        throw "ABORT: Commercial Reminder Worker is online! It must remain stopped."
    }
    Write-Host "Commercial Reminder Worker : $reminderAfterState (Verified Stopped/Absent)" -ForegroundColor Green

    # 5. HTTP Health & Login smoke tests
    $webEndpoints = @(
        "http://127.0.0.1:3200/login",
        "http://10.10.50.24:3200/login",
        "http://127.0.0.1:3200/api/v1/health"
    )
    foreach ($u in $webEndpoints) {
        $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15
        if ([int]$resp.StatusCode -ne 200) {
            throw "ABORT: Smoke test failed for $u (HTTP $($resp.StatusCode))."
        }
        Write-Host ("Smoke Test {0} -> HTTP {1}" -f $u, $resp.StatusCode) -ForegroundColor Green
    }

    # 6. Commercial Auth Guard tests (unauthenticated requests must receive 401)
    $guardedApis = @(
        "http://127.0.0.1:3200/api/v1/commercial/opportunities",
        "http://127.0.0.1:3200/api/v1/commercial/costing",
        "http://127.0.0.1:3200/api/v1/commercial/proposals"
    )
    foreach ($api in $guardedApis) {
        $statusCode = 0
        try {
            $r = Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 15
            $statusCode = [int]$r.StatusCode
        } catch {
            if ($null -ne $_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            } else {
                throw
            }
        }
        if ($statusCode -ne 401) {
            throw "ABORT: Expected HTTP 401 from unauthenticated $api, received HTTP $statusCode."
        }
        Write-Host ("Auth Guard {0} -> HTTP {1} (Verified)" -f $api, $statusCode) -ForegroundColor Green
    }

    # 7. Web PM2 log inspection
    Invoke-NativeStep -StepName "Inspect Web PM2 Logs" -Command {
        pm2 logs ahh-wfm-web-dev --lines 20 --nostream
    }

    # 8. Final Git state verification
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $finalHead   = ((git rev-parse HEAD) -join "").Trim()
    $finalBranch = ((git branch --show-current) -join "").Trim()
    $finalStatus = ((git status --porcelain) -join "`n").Trim()
    $ErrorActionPreference = $prevPref

    if ($finalHead -ne $TargetSha -or $finalBranch -ne $ExpectedBranch -or -not [string]::IsNullOrWhiteSpace($finalStatus)) {
        throw "ABORT: Final Git state verification failed. Branch=$finalBranch, HEAD=$finalHead, Status=$finalStatus"
    }

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " VIBE-14 V3 DEPLOYMENT SUCCEEDED & VERIFIED AT SHA: $finalHead    " -ForegroundColor Green
    Write-Host " Deployment ID    : $DeploymentId                                " -ForegroundColor Green
    Write-Host " Branch Preserved : $finalBranch                                 " -ForegroundColor Green
    Write-Host " New Web BUILD_ID : $newWebBuildId ($($newWebBuildIdFile.LastWriteTime))" -ForegroundColor Green
    Write-Host " Complete Backup  : $BackupRoot ($($srcCatalog.Count) files)     " -ForegroundColor Green
    Write-Host " Mobile & Workers : 100% Preserved (Unchanged PIDs & Restarts)   " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
