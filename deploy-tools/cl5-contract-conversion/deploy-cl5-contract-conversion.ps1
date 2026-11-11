# RUN ON SERVER
# AHH WFM -- CL-5 Contract Conversion UAT Remediation Pinned SERVER Deployment Script (PowerShell 5.1 Compatible)
# Baseline SHA : 58405a429362500de875e4b20d5fe46abc5218dd (Confirmed Deployed SERVER Baseline)
# Target SHA   : b3a1ec056fd739111882622366fe198e11b6b8dc (Pinned CL-5 Remediation Commit)
# Intermediate : 685e4c4004355c75cbff7ec5a7e38b4a51e6ac7e (Initial CL-5 Remediation Commit)
# Forbidden P0 : cb35ce886b17b43d20da164171373f706214dddd (Undeployed UM-RBAC-1 P0; must NEVER be deployed)
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

    function Verify-DirectoryAgainstCatalog {
        param(
            [Parameter(Mandatory = $true)][string]$DirectoryPath,
            [Parameter(Mandatory = $true)][hashtable]$ExpectedCatalog
        )
        $actualCatalog = Get-CompleteDirectoryCatalog -DirectoryPath $DirectoryPath
        if ($actualCatalog.Count -ne $ExpectedCatalog.Count) {
            throw "ABORT: File count mismatch in '$DirectoryPath' (actual=$($actualCatalog.Count), expected=$($ExpectedCatalog.Count))."
        }
        foreach ($entry in $ExpectedCatalog.GetEnumerator()) {
            $relPath = $entry.Key
            $expectedHash = $entry.Value
            if (-not $actualCatalog.Contains($relPath)) {
                throw "ABORT: Missing file '$relPath' in '$DirectoryPath'."
            }
            if ($actualCatalog[$relPath] -ne $expectedHash) {
                throw "ABORT: SHA-256 mismatch for '$relPath' in '$DirectoryPath'."
            }
        }
    }

    function Remove-JunctionSafe {
        param([Parameter(Mandatory = $true)][string]$JunctionPath)
        if (Test-Path -LiteralPath $JunctionPath) {
            $item = Get-Item -LiteralPath $JunctionPath -Force
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                [System.IO.Directory]::Delete($JunctionPath)
            }
        }
    }

    function Move-DirectorySafe {
        param(
            [Parameter(Mandatory = $true)][string]$SourcePath,
            [Parameter(Mandatory = $true)][string]$DestPath
        )
        try {
            [System.IO.Directory]::Move($SourcePath, $DestPath)
        } catch {
            Copy-Item -LiteralPath $SourcePath -Destination $DestPath -Recurse -Force
            Remove-Item -LiteralPath $SourcePath -Recurse -Force
        }
    }

    function Cleanup-StageWorktree {
        param(
            [string]$RepoRoot,
            [string]$WorktreePath
        )
        if ([string]::IsNullOrWhiteSpace($WorktreePath)) { return }
        try {
            Remove-JunctionSafe -JunctionPath (Join-Path $WorktreePath "node_modules")
            Remove-JunctionSafe -JunctionPath (Join-Path $WorktreePath "apps\web\node_modules")
        } catch {}
        if (Test-Path -LiteralPath $WorktreePath) {
            $prev = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            try {
                Push-Location -LiteralPath $RepoRoot
                git -c core.longpaths=true worktree remove --force "$WorktreePath" 2>$null
                Pop-Location
            } catch {}
            $ErrorActionPreference = $prev
            if (Test-Path -LiteralPath $WorktreePath) {
                Remove-Item -LiteralPath $WorktreePath -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }

    $ExpectedBranch      = "manpower-operations-scope"
    $ExpectedOrigin      = "https://github.com/AHHGIT2025/AHH-WFM.git"
    $BaselineSha         = "58405a429362500de875e4b20d5fe46abc5218dd"
    $TargetSha           = "b3a1ec056fd739111882622366fe198e11b6b8dc"
    $IntermediateSha     = "685e4c4004355c75cbff7ec5a7e38b4a51e6ac7e"
    $ForbiddenP0Sha      = "cb35ce886b17b43d20da164171373f706214dddd"
    $SourceBranch        = "fix/cl5-contract-conversion-uat"
    $Timestamp           = Get-Date -Format "yyyyMMdd-HHmmss"
    $DeploymentId        = "deploy-cl5-$TargetSha-$Timestamp"
    $BackupRoot          = Join-Path $BackupsParent "pre-deploy-cl5-$TargetSha-$Timestamp"
    $AttemptPointerPath  = Join-Path $BackupsParent "latest-cl5-deployment-attempt.json"

    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 1: READ-ONLY SERVER PREFLIGHT & WORKER PROTECTION CHECK   " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    if (-not (Test-Path -LiteralPath $RepoPath)) {
        throw "NO-GO ABORT: SERVER repository path '$RepoPath' does not exist."
    }
    Set-Location -LiteralPath $RepoPath

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $currentOrigin = ((git remote get-url origin) -join "").Trim()
    $originExit    = $LASTEXITCODE
    $currentHead   = ((git rev-parse HEAD) -join "").Trim()
    $headExit      = $LASTEXITCODE
    $currentBranch = ((git branch --show-current) -join "").Trim()
    $branchExit    = $LASTEXITCODE
    $worktreeLines = @(git status --porcelain)
    $statusExit    = $LASTEXITCODE
    $ErrorActionPreference = $prevPref

    if ($originExit -ne 0 -or $headExit -ne 0 -or $branchExit -ne 0 -or $statusExit -ne 0) {
        throw "NO-GO ABORT: Preflight Git inspection failed."
    }

    $pm2Procs = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath

    Write-Host "Deployment ID        : $DeploymentId"
    Write-Host "Repository Path      : $RepoPath"
    Write-Host "Active Branch        : $currentBranch"
    Write-Host "Origin Remote        : $currentOrigin"
    Write-Host "Current HEAD         : $currentHead"
    Write-Host "Required Base SHA    : $BaselineSha"
    Write-Host "Pinned Target SHA    : $TargetSha"
    Write-Host "Backup Path          : $BackupRoot"

    if ($currentBranch -ne $ExpectedBranch) {
        throw "NO-GO ABORT: Expected branch '$ExpectedBranch', found '$currentBranch'."
    }
    if ($currentOrigin -ne $ExpectedOrigin) {
        throw "NO-GO ABORT: Expected origin '$ExpectedOrigin', found '$currentOrigin'."
    }
    if ($currentHead -ne $BaselineSha) {
        throw "NO-GO ABORT: Expected current SERVER HEAD '$BaselineSha', found '$currentHead'."
    }
    $worktreeJoined = ($worktreeLines -join "`n").Trim()
    if (-not [string]::IsNullOrWhiteSpace($worktreeJoined)) {
        throw "NO-GO ABORT: Working tree is not clean:`n$worktreeJoined"
    }

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
        $proc    = $pm2Procs | Where-Object { $_.name -eq $wName }
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

    $mobileProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
    $baselineMobileState   = if ($null -ne $mobileProc) { [string]$mobileProc.status } else { "absent" }
    $baselineMobilePid     = if ($null -ne $mobileProc) { [int]$mobileProc.pid } else { 0 }
    $baselineMobileRestart = if ($null -ne $mobileProc) { [int]$mobileProc.restart_time } else { 0 }
    Write-Host ("Mobile Service   [ahh-wfm-mobile-dev] : status={0}, pid={1}, restarts={2}" -f $baselineMobileState, $baselineMobilePid, $baselineMobileRestart)
    if ($baselineMobileState -ne "online") {
        throw "NO-GO ABORT: Mobile service 'ahh-wfm-mobile-dev' is not online ($baselineMobileState)."
    }

    $webProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
    $baselineWebState = if ($null -ne $webProc) { [string]$webProc.status } else { "absent" }
    Write-Host ("Web Service      [ahh-wfm-web-dev] : status={0}" -f $baselineWebState)
    if ($baselineWebState -ne "online") {
        throw "NO-GO ABORT: Web service 'ahh-wfm-web-dev' is not online ($baselineWebState)."
    }

    $reminderProc = $pm2Procs | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
    $reminderState = if ($null -ne $reminderProc) { [string]$reminderProc.status } else { "absent" }
    if ($reminderState -eq "online") {
        throw "NO-GO ABORT: 'ahh-wfm-commercial-reminder-worker-dev' is online. It must remain stopped."
    }
    Write-Host "Commercial Reminder Worker : $reminderState (OK - Stopped/Absent)"

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 2: COMPLETE .NEXT BACKUP & 100% FILE INTEGRITY HASHING    " -ForegroundColor Cyan
    Write-Host " (Web remains ONLINE serving live build)                         " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $webNextPath = Join-Path $RepoPath "apps\web\.next"
    if (-not (Test-NextBuildDirectory -NextDirPath $webNextPath)) {
        throw "NO-GO ABORT: Pre-deploy Web build directory '$webNextPath' is invalid or missing required manifest files."
    }

    $webBuildIdFile     = Get-Item -LiteralPath (Join-Path $webNextPath "BUILD_ID")
    $preWebBuildId      = (Get-Content -LiteralPath $webBuildIdFile.FullName -Raw).Trim()
    $preWebBuildTimeUtc = $webBuildIdFile.LastWriteTimeUtc
    Write-Host ("Pre-Deploy Web BUILD_ID : {0} (LastModified: {1})" -f $preWebBuildId, $webBuildIdFile.LastWriteTime)

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

    Write-Host "Verifying complete 100% file integrity in backup directory '$bakWebNext'..."
    Verify-DirectoryAgainstCatalog -DirectoryPath $bakWebNext -ExpectedCatalog $srcCatalog
    Write-Host ("100% file integrity verified across all {0} backup files." -f $srcCatalog.Count) -ForegroundColor Green

    $manifestFile = Join-Path $BackupRoot "backup-manifest.json"
    $baselineWorkersRecord = [ordered]@{}
    foreach ($wName in $protectedWorkers) {
        $baselineWorkersRecord[$wName] = [ordered]@{
            status       = $baselineWorkerState[$wName]
            pid          = $baselineWorkerPid[$wName]
            restart_time = $baselineWorkerRestart[$wName]
        }
    }
    $baselineMobileRecord = [ordered]@{
        status       = $baselineMobileState
        pid          = $baselineMobilePid
        restart_time = $baselineMobileRestart
    }

    $manifestObj = [ordered]@{
        deploymentId       = $DeploymentId
        createdAt          = (Get-Date).ToString("o")
        baselineSha        = $BaselineSha
        targetSha          = $TargetSha
        branch             = $ExpectedBranch
        backupRoot         = $BackupRoot
        preWebBuildId      = $preWebBuildId
        preWebBuildTimeUtc = $preWebBuildTimeUtc.ToString("o")
        isRollbackReady    = $true
        baselineWorkers    = $baselineWorkersRecord
        baselineMobile     = $baselineMobileRecord
        webNextFileCount   = $srcCatalog.Count
        webNextFileCatalog = $srcCatalog
    }
    ($manifestObj | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $manifestFile -Encoding UTF8
    if (-not (Test-Path -LiteralPath $manifestFile)) {
        throw "NO-GO ABORT: Failed to write '$manifestFile'."
    }

    $pointerObj = [ordered]@{
        deploymentId     = $DeploymentId
        createdAt        = $manifestObj.createdAt
        baselineSha      = $BaselineSha
        targetSha        = $TargetSha
        branch           = $ExpectedBranch
        backupRoot       = $BackupRoot
        manifestPath     = $manifestFile
        baselineWorkers  = $baselineWorkersRecord
        baselineMobile   = $baselineMobileRecord
        webNextFileCount = $srcCatalog.Count
    }
    ($pointerObj | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $AttemptPointerPath -Encoding UTF8
    if (-not (Test-Path -LiteralPath $AttemptPointerPath)) {
        throw "NO-GO ABORT: Failed to write attempt pointer '$AttemptPointerPath'."
    }
    Write-Host "Complete backup registered and locked in $BackupRoot" -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 3: FETCH, SAFE P0 CHECK & PINNED CL-5 RELEASE GATES       " -ForegroundColor Cyan
    Write-Host " (No live merge yet; Web remains ONLINE at baseline)             " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    Invoke-NativeStep -StepName "git fetch origin $SourceBranch" -Command {
        git fetch origin $SourceBranch
    }

    Invoke-NativeStep -StepName "Verify target commit exists ($TargetSha)" -Command {
        git cat-file -e $TargetSha
        if ($LASTEXITCODE -ne 0) { throw "Target object '$TargetSha' missing" }
        $objType = ((git cat-file -t $TargetSha) -join "").Trim()
        if ($LASTEXITCODE -ne 0 -or $objType -ne "commit") { throw "Target '$TargetSha' is '$objType', expected 'commit'" }
    }

    Invoke-NativeStep -StepName "Verify baseline -> target ancestry ($BaselineSha -> $TargetSha)" -Command {
        git merge-base --is-ancestor $BaselineSha $TargetSha
    }

    Invoke-NativeStep -StepName "Verify target commit is in origin/$SourceBranch" -Command {
        git merge-base --is-ancestor $TargetSha "origin/$SourceBranch"
    }

    # Gate: Strictly the 2 pinned CL-5 commits between BaselineSha and TargetSha
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $revListRaw = @(git rev-list "$BaselineSha..$TargetSha")
    $revListExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    $expectedCommits = @($TargetSha, $IntermediateSha)
    $revListMismatch = Compare-Object -ReferenceObject $expectedCommits -DifferenceObject $revListRaw -SyncWindow 0
    if ($revListExit -ne 0 -or $null -ne $revListMismatch) {
        throw "NO-GO ABORT: Commit chain mismatch in '$BaselineSha..$TargetSha'. Expected: $($expectedCommits -join ', '). Found: $($revListRaw -join ', ')"
    }
    Write-Host "Verified strict 2-commit CL-5 delta ($IntermediateSha -> $TargetSha)." -ForegroundColor Green

    # Safe P0 exclusion validation without misinterpreting exit code 128 on absent Git objects
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    git cat-file -e $ForbiddenP0Sha 2>$null
    $p0ExistsExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPref

    if ($p0ExistsExit -eq 0) {
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        git merge-base --is-ancestor $ForbiddenP0Sha $TargetSha 2>$null
        $p0AncExit = $LASTEXITCODE
        $ErrorActionPreference = $prevPref

        if ($p0AncExit -eq 0) {
            throw "CRITICAL NO-GO ABORT: Target commit '$TargetSha' contains forbidden UM-RBAC-1 P0 commit '$ForbiddenP0Sha'!"
        } elseif ($p0AncExit -ne 1) {
            throw "NO-GO ABORT: Unexpected Git exit code ($p0AncExit) during P0 ancestry check for '$ForbiddenP0Sha'."
        }
        Write-Host "Verified P0 exclusion: '$ForbiddenP0Sha' is present in Git store and confirmed NOT an ancestor of '$TargetSha'." -ForegroundColor Green
    } elseif ($p0ExistsExit -eq 1) {
        Write-Host "P0 Git object '$ForbiddenP0Sha' is not present in SERVER Git object store (expected; P0 was never fetched)." -ForegroundColor Yellow
        Write-Host "P0 exclusion enforced via pinned 2-commit ancestry ($BaselineSha -> $TargetSha), exact 10-file diff, and verified LOCAL provenance." -ForegroundColor Yellow
    } else {
        throw "NO-GO ABORT: Unexpected Git exit code ($p0ExistsExit) checking P0 object '$ForbiddenP0Sha'."
    }

    # Exact 10-file CL-5 release diff gate (zero migrations, zero schema modifications)
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $diffFiles = @(git diff --name-only $BaselineSha $TargetSha)
    $diffExit  = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    if ($diffExit -ne 0) {
        throw "NO-GO ABORT: git diff --name-only failed with exit code $diffExit."
    }

    $expectedFiles = @(
        "apps/web/app/api/v1/commercial/opportunities/route.ts",
        "apps/web/app/api/v1/commercial/proposals/[id]/conversion-readiness/route.ts",
        "apps/web/app/api/v1/commercial/proposals/[id]/convert/route.ts",
        "apps/web/app/api/v1/commercial/proposals/[id]/route.ts",
        "apps/web/app/api/v1/commercial/proposals/route.ts",
        "apps/web/app/commercial/contract-conversion/[id]/page.tsx",
        "apps/web/app/commercial/proposals/[id]/page.tsx",
        "apps/web/app/commercial/quotations/page.tsx",
        "apps/web/lib/contract-conversion.ts",
        "tests/api/cl5-uat-conversion-remediation.spec.ts"
    )
    $diffMismatch = Compare-Object -ReferenceObject $expectedFiles -DifferenceObject $diffFiles
    if ($null -ne $diffMismatch) {
        throw "NO-GO ABORT: Release diff mismatch between $BaselineSha and $TargetSha. Found: $($diffFiles -join ', ')"
    }
    if (@($diffFiles | Where-Object { $_ -match "prisma|migration" }).Count -gt 0) {
        throw "NO-GO ABORT: Unexpected Prisma or migration file in CL-5 diff!"
    }
    Write-Host "Verified exact 10-file CL-5 release diff (0 migrations, 0 unexpected modifications):" -ForegroundColor Green
    $diffFiles | ForEach-Object { Write-Host "  - $_" }

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 4: ISOLATED STAGING BUILD BEFORE WEB SERVICE DOWNTIME     " -ForegroundColor Cyan
    Write-Host " (Web remains ONLINE; live apps/web/.next NOT overwritten)       " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $StageWorktreeDir = Join-Path $BackupsParent "stage-$PID-$Timestamp"
    $StagedWebNext    = Join-Path $BackupRoot "staged-web-next"
    $buildStartTimeUtc = (Get-Date).ToUniversalTime()
    $newCatalog = $null
    $newWebBuildId = ""
    $newWebBuildTimeUtc = $null

    try {
        Invoke-NativeStep -StepName "Create detached staging worktree at $TargetSha" -Command {
            git -c core.longpaths=true worktree add --detach "$StageWorktreeDir" $TargetSha
        }

        if (Test-Path -LiteralPath (Join-Path $RepoPath ".env")) {
            Copy-Item -LiteralPath (Join-Path $RepoPath ".env") -Destination (Join-Path $StageWorktreeDir ".env") -Force
        }
        Get-ChildItem -LiteralPath (Join-Path $RepoPath "apps\web") -Filter ".env*" -File -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $StageWorktreeDir "apps\web\$($_.Name)") -Force
        }
        if (Test-Path -LiteralPath (Join-Path $RepoPath "packages\database\dist")) {
            Copy-Item -LiteralPath (Join-Path $RepoPath "packages\database\dist") -Destination (Join-Path $StageWorktreeDir "packages\database\dist") -Recurse -Force
        }
        if (Test-Path -LiteralPath (Join-Path $RepoPath "packages\database\src\generated")) {
            Copy-Item -LiteralPath (Join-Path $RepoPath "packages\database\src\generated") -Destination (Join-Path $StageWorktreeDir "packages\database\src\generated") -Recurse -Force
        }

        if (-not (Test-Path -LiteralPath (Join-Path $RepoPath "node_modules"))) {
            throw "NO-GO ABORT: Root node_modules missing at '$RepoPath\node_modules'."
        }
        Invoke-NativeStep -StepName "Link root node_modules junction into staging worktree" -Command {
            cmd /c mklink /J "`"$StageWorktreeDir\node_modules`"" "`"$RepoPath\node_modules`""
        }
        if (Test-Path -LiteralPath (Join-Path $RepoPath "apps\web\node_modules")) {
            Invoke-NativeStep -StepName "Link apps/web/node_modules junction into staging worktree" -Command {
                cmd /c mklink /J "`"$StageWorktreeDir\apps\web\node_modules`"" "`"$RepoPath\apps\web\node_modules`""
            }
        }

        Push-Location -LiteralPath $StageWorktreeDir
        try {
            Invoke-NativeStep -StepName "prisma validate (staging)" -Command {
                npx.cmd prisma validate --schema packages/database/prisma/schema.prisma
            }
            Invoke-NativeStep -StepName "npm run build --workspace=apps/web (staging)" -Command {
                npm.cmd run build --workspace=apps/web
            }
        } finally {
            Pop-Location
        }

        $stageBuiltNext = Join-Path $StageWorktreeDir "apps\web\.next"
        if (-not (Test-NextBuildDirectory -NextDirPath $stageBuiltNext)) {
            throw "NO-GO ABORT: Staged Web build at '$stageBuiltNext' failed structural validation. Live Web was NOT stopped or altered."
        }

        $conversionPageChunk = Join-Path $stageBuiltNext "server\app\commercial\contract-conversion\[id]\page.js"
        if (-not (Test-Path -LiteralPath $conversionPageChunk)) {
            throw "NO-GO ABORT: Expected CL-5 route build artifact missing at '$conversionPageChunk'."
        }

        $newWebBuildIdFile  = Get-Item -LiteralPath (Join-Path $stageBuiltNext "BUILD_ID")
        $newWebBuildId      = (Get-Content -LiteralPath $newWebBuildIdFile.FullName -Raw).Trim()
        $newWebBuildTimeUtc = $newWebBuildIdFile.LastWriteTimeUtc
        if ($newWebBuildTimeUtc -le $preWebBuildTimeUtc -or $newWebBuildTimeUtc -lt $buildStartTimeUtc.AddSeconds(-5)) {
            throw "NO-GO ABORT: Staged BUILD_ID timestamp was not updated by build."
        }

        Write-Host ("Staged Web build validated (BUILD_ID: {0} -> {1}). Cataloging SHA-256..." -f $preWebBuildId, $newWebBuildId) -ForegroundColor Cyan
        $newCatalog = Get-CompleteDirectoryCatalog -DirectoryPath $stageBuiltNext
        Copy-Item -LiteralPath $stageBuiltNext -Destination $StagedWebNext -Recurse -Force
        Verify-DirectoryAgainstCatalog -DirectoryPath $StagedWebNext -ExpectedCatalog $newCatalog
        Write-Host ("Staged replacement build locked & verified ({0} files) at: {1}" -f $newCatalog.Count, $StagedWebNext) -ForegroundColor Green
    } finally {
        Cleanup-StageWorktree -RepoRoot $RepoPath -WorktreePath $StageWorktreeDir
    }

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 5: SHORT MAINTENANCE WINDOW -- SWAP, MERGE & WEB RESTART  " -ForegroundColor Cyan
    Write-Host " (Mobile & 4 protected workers remain ONLINE throughout)         " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $DisplacedNextPath = Join-Path $BackupRoot "displaced-predeploy-web-next-$ts"
    $webStopped = $false

    try {
        Invoke-NativeStep -StepName "pm2 stop ahh-wfm-web-dev" -Command {
            pm2 stop ahh-wfm-web-dev
        }
        $webStopped = $true
        Start-Sleep -Seconds 2

        Invoke-NativeStep -StepName "git merge --ff-only $TargetSha" -Command {
            git merge --ff-only $TargetSha
        }

        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $deployedHead   = ((git rev-parse HEAD) -join "").Trim()
        $deployedBranch = ((git branch --show-current) -join "").Trim()
        $ErrorActionPreference = $prevPref

        if ($deployedHead -eq $ForbiddenP0Sha) {
            throw "CRITICAL ABORT: SERVER HEAD advanced to forbidden P0 commit '$ForbiddenP0Sha'!"
        }
        if ($deployedHead -ne $TargetSha) {
            throw "ABORT: Post-merge HEAD is '$deployedHead', expected '$TargetSha'."
        }
        if ($deployedBranch -ne $ExpectedBranch) {
            throw "ABORT: SERVER branch changed to '$deployedBranch', expected '$ExpectedBranch'."
        }
        Write-Host "SERVER branch '$deployedBranch' preserved and fast-forwarded to: $deployedHead" -ForegroundColor Green

        try {
            Move-DirectorySafe -SourcePath $webNextPath -DestPath $DisplacedNextPath
            Write-Host "Previous live .next preserved at: $DisplacedNextPath" -ForegroundColor Yellow
            Move-DirectorySafe -SourcePath $StagedWebNext -DestPath $webNextPath
        } catch {
            $swapErr = $_.Exception.Message
            if (-not (Test-Path -LiteralPath $webNextPath) -and (Test-Path -LiteralPath $DisplacedNextPath)) {
                try { Move-DirectorySafe -SourcePath $DisplacedNextPath -DestPath $webNextPath } catch {}
            }
            throw "ABORT: Build swap failed ($swapErr). Recover via recover-cl5-contract-conversion.ps1 -BackupRoot '$BackupRoot'."
        }

        Verify-DirectoryAgainstCatalog -DirectoryPath $webNextPath -ExpectedCatalog $newCatalog
        Write-Host ("Switched live apps/web/.next to validated build (BUILD_ID: {0})." -f $newWebBuildId) -ForegroundColor Green

        Invoke-NativeStep -StepName "pm2 restart ahh-wfm-web-dev --update-env" -Command {
            pm2 restart ahh-wfm-web-dev --update-env
        }
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "`n[SAFE STOP] Deployment halted during maintenance window: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[SAFE STOP] Verified baseline backup remains preserved at: $BackupRoot" -ForegroundColor Yellow
        if ($webStopped) {
            Write-Host "[SAFE STOP] To restore baseline safely run: recover-cl5-contract-conversion.ps1 -BackupRoot `"$BackupRoot`"" -ForegroundColor Yellow
        }
        throw
    }

    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " PHASE 6: POST-DEPLOYMENT SMOKE, AUTH & WORKER PID PRESERVATION  " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan

    $pm2After = Get-NormalizedPm2List -NormalizerPath $NormalizerScriptPath

    $pWeb = $pm2After | Where-Object { $_.name -eq "ahh-wfm-web-dev" }
    if ($null -eq $pWeb -or [string]$pWeb.status -ne "online") {
        throw "ABORT: Web service 'ahh-wfm-web-dev' is not online after restart. Backup & displaced build preserved in '$BackupRoot'."
    }
    Write-Host ("Web Service [ahh-wfm-web-dev] : online (PID {0})" -f $pWeb.pid) -ForegroundColor Green

    $pMob = $pm2After | Where-Object { $_.name -eq "ahh-wfm-mobile-dev" }
    $afterMobState   = if ($null -ne $pMob) { [string]$pMob.status } else { "absent" }
    $afterMobPid     = if ($null -ne $pMob) { [int]$pMob.pid } else { 0 }
    $afterMobRestart = if ($null -ne $pMob) { [int]$pMob.restart_time } else { 0 }
    if ($afterMobState -ne $baselineMobileState -or $afterMobPid -ne $baselineMobilePid -or $afterMobRestart -ne $baselineMobileRestart) {
        throw "ABORT: Mobile service was disturbed! Baseline PID=$baselineMobilePid (restarts=$baselineMobileRestart), After PID=$afterMobPid (restarts=$afterMobRestart)."
    }
    Write-Host ("Mobile Service [ahh-wfm-mobile-dev] : Preserved (PID {0}, restarts {1})" -f $afterMobPid, $afterMobRestart) -ForegroundColor Green

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

    $reminderAfter = $pm2After | Where-Object { $_.name -eq "ahh-wfm-commercial-reminder-worker-dev" }
    $reminderAfterState = if ($null -ne $reminderAfter) { [string]$reminderAfter.status } else { "absent" }
    if ($reminderAfterState -eq "online") {
        throw "ABORT: Commercial Reminder Worker is online! It must remain stopped."
    }
    Write-Host "Commercial Reminder Worker : $reminderAfterState (Verified Stopped/Absent)" -ForegroundColor Green

    $webEndpoints = @(
        "http://127.0.0.1:3200/login",
        "http://10.10.50.24:3200/login",
        "http://127.0.0.1:3201/login",
        "http://10.10.50.24:3201/login"
    )
    foreach ($u in $webEndpoints) {
        $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15
        if ([int]$resp.StatusCode -ne 200) {
            throw "ABORT: Smoke test failed for $u (HTTP $($resp.StatusCode))."
        }
        Write-Host ("Smoke Test {0} -> HTTP {1}" -f $u, $resp.StatusCode) -ForegroundColor Green
    }

    $guardedApis = @(
        "http://127.0.0.1:3200/api/v1/commercial/opportunities",
        "http://127.0.0.1:3200/api/v1/commercial/costing",
        "http://127.0.0.1:3200/api/v1/commercial/proposals",
        "http://127.0.0.1:3200/api/v1/commercial/proposals/ebf98ba2-fb41-4c17-830d-50d648dd0806/conversion-readiness"
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

    Invoke-NativeStep -StepName "Inspect Web PM2 Logs" -Command {
        pm2 logs ahh-wfm-web-dev --lines 20 --nostream
    }

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
    Write-Host " CL-5 REMEDIATION DEPLOYED & VERIFIED AT SHA: $finalHead        " -ForegroundColor Green
    Write-Host " Deployment ID    : $DeploymentId                                " -ForegroundColor Green
    Write-Host " Branch Preserved : $finalBranch                                 " -ForegroundColor Green
    Write-Host " New Web BUILD_ID : $newWebBuildId ($newWebBuildTimeUtc UTC)     " -ForegroundColor Green
    Write-Host " Complete Backup  : $BackupRoot ($($srcCatalog.Count) files)     " -ForegroundColor Green
    Write-Host " Displaced Build  : $DisplacedNextPath (Preserved)               " -ForegroundColor Green
    Write-Host " Mobile & Workers : 100% Preserved (Unchanged PIDs & Restarts)   " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
