[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..\..\..")).Path
$sourceSha = (& git -C $repo rev-parse HEAD).Trim()
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactRoot = Join-Path $here "artifacts\$stamp"
$clone = Join-Path $env:TEMP "agent-airlock-e2e-$stamp"
$transcript = Join-Path $artifactRoot "test-execution.txt"
$summaryPath = Join-Path $artifactRoot "summary.json"

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

$summary = [ordered]@{
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
    sourceSha = $sourceSha
    sourceBranch = (& git -C $repo branch --show-current).Trim()
    freshClone = $clone
    status = "running"
    commands = @(
        "npm ci"
        "npm run setup"
        "npm test"
        "node --test sandbox/tests/configure.test.mjs"
    )
}

function Write-Recorded {
    param([string]$Text)
    $Text | Tee-Object -FilePath $transcript -Append
}

function Invoke-Recorded {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    Write-Recorded ""
    Write-Recorded ">>> $Label"
    & $Command 2>&1 | Tee-Object -FilePath $transcript -Append
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

@(
    "Agent Airlock fresh-clone E2E"
    "Started: $($summary.startedAt)"
    "Source: $sourceSha"
    "Artifacts: $artifactRoot"
) | Set-Content -Path $transcript -Encoding utf8

try {
    Get-Content $transcript | Write-Host
    Invoke-Recorded "git clone --no-hardlinks <repository> <temporary-clone>" {
        & git clone --quiet --no-hardlinks $repo $clone
    }
    Invoke-Recorded "git checkout --detach $sourceSha" {
        & git -C $clone checkout --quiet --detach $sourceSha
    }

    $plugin = Join-Path $clone "plugins\AirlockPlugin"
    Invoke-Recorded "npm ci" {
        & npm --prefix $plugin ci
    }
    Invoke-Recorded "npm run setup" {
        & npm --prefix $plugin run setup
    }
    Invoke-Recorded "npm test" {
        & npm --prefix $plugin test
    }
    Invoke-Recorded "node --test sandbox/tests/configure.test.mjs" {
        & node --test (Join-Path $clone "sandbox\tests\configure.test.mjs")
    }

    $summary.status = "passed"
}
catch {
    $summary.status = "failed"
    $summary.error = $_.Exception.Message
    throw
}
finally {
    $summary.completedAt = (Get-Date).ToUniversalTime().ToString("o")
    $summary.artifactRoot = $artifactRoot
    $summary.transcript = $transcript
    $summary.freshCloneRemoved = $true
    $summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding utf8
    if (Test-Path $clone) {
        Remove-Item -LiteralPath $clone -Recurse -Force
    }
    Write-Recorded ""
    Write-Recorded "Final status: $($summary.status)"
    Write-Recorded "Summary: $summaryPath"
    Write-Recorded "Transcript: $transcript"
}
