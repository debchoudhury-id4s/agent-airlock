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

Start-Transcript -Path $transcript -Force | Out-Null
try {
    Write-Host "Agent Airlock fresh-clone E2E"
    Write-Host "Source: $sourceSha"
    Write-Host "Artifacts: $artifactRoot"

    & git clone --quiet --no-hardlinks $repo $clone
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
    & git -C $clone checkout --quiet --detach $sourceSha
    if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }

    $plugin = Join-Path $clone "plugins\AirlockPlugin"
    & npm --prefix $plugin ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    & npm --prefix $plugin run setup
    if ($LASTEXITCODE -ne 0) { throw "plugin setup failed" }
    & npm --prefix $plugin test
    if ($LASTEXITCODE -ne 0) { throw "plugin tests failed" }
    & node --test (Join-Path $clone "sandbox\tests\configure.test.mjs")
    if ($LASTEXITCODE -ne 0) { throw "sandbox tests failed" }

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
    $summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding utf8
    Stop-Transcript | Out-Null
    if (Test-Path $clone) {
        Remove-Item -LiteralPath $clone -Recurse -Force
    }
    Write-Host "Summary: $summaryPath"
    Write-Host "Transcript: $transcript"
}
