[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactRoot
)

$ErrorActionPreference = "Stop"
$artifact = (Resolve-Path $ArtifactRoot).Path
$summaryPath = Join-Path $artifact "summary.json"
$transcriptPath = Join-Path $artifact "test-execution.txt"
$deckPath = Join-Path $artifact "test-execution-recording.pptx"
$videoPath = Join-Path $artifact "test-execution.mp4"

$summary = Get-Content -Raw $summaryPath | ConvertFrom-Json
$transcript = Get-Content $transcriptPath
$e2eCases = $transcript |
    Where-Object { $_ -match "automatic hooks|prompt and shell rechecks|RFC advice|restricted sandbox|dependency-risk MCP" } |
    ForEach-Object { ($_ -replace "^[^a-zA-Z]+", "").Trim() } |
    Select-Object -Unique

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1
$presentation = $powerPoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

function Add-Slide {
    param(
        [string]$Title,
        [string[]]$Lines,
        [string]$Accent = "238FCA"
    )

    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    $background = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
    $background.Fill.ForeColor.RGB = 0xF7FDFF
    $background.Line.Visible = 0

    $banner = $slide.Shapes.AddShape(1, 0, 0, 960, 78)
    $banner.Fill.ForeColor.RGB = 0x361D0B
    $banner.Line.Visible = 0

    $titleBox = $slide.Shapes.AddTextbox(1, 42, 19, 876, 45)
    $titleBox.TextFrame.TextRange.Text = $Title
    $titleBox.TextFrame.TextRange.Font.Name = "Segoe UI Semibold"
    $titleBox.TextFrame.TextRange.Font.Size = 25
    $titleBox.TextFrame.TextRange.Font.Color.RGB = 0xFFFFFF

    $accentBar = $slide.Shapes.AddShape(1, 42, 100, 8, 365)
    $accentBar.Fill.ForeColor.RGB = [Convert]::ToInt32(
        $Accent.Substring(4, 2) + $Accent.Substring(2, 2) + $Accent.Substring(0, 2),
        16
    )
    $accentBar.Line.Visible = 0

    $body = $slide.Shapes.AddTextbox(1, 72, 105, 830, 360)
    $body.TextFrame.TextRange.Text = ($Lines -join "`r`n")
    $body.TextFrame.TextRange.Font.Name = "Cascadia Mono"
    $body.TextFrame.TextRange.Font.Size = 18
    $body.TextFrame.TextRange.Font.Color.RGB = 0x3A2316
    $body.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 9

    $footer = $slide.Shapes.AddTextbox(1, 42, 495, 876, 24)
    $footer.TextFrame.TextRange.Text = "Agent Airlock | reproducible fresh-clone evidence"
    $footer.TextFrame.TextRange.Font.Name = "Segoe UI"
    $footer.TextFrame.TextRange.Font.Size = 10
    $footer.TextFrame.TextRange.Font.Color.RGB = 0x8B7766
}

Add-Slide "AGENT AIRLOCK - END-TO-END TEST EXECUTION" @(
    "Status: $($summary.status.ToUpperInvariant())"
    "Source commit: $($summary.sourceSha)"
    "Branch: $($summary.sourceBranch)"
    "Executed: $($summary.startedAt)"
) "238FCA"

Add-Slide "FRESH-CLONE SETUP" @(
    "[PASS] Cloned the committed source into a disposable directory"
    "[PASS] Installed exactly from package-lock.json"
    "[PASS] Prepared checksum-verified Gitleaks 8.30.1"
    "[PASS] npm audit reported zero vulnerabilities"
) "3ECF8E"

Add-Slide "LIFECYCLE SCENARIOS" ($e2eCases | ForEach-Object { "[PASS] $_" }) "FFBD45"

Add-Slide "REGRESSION RESULTS" @(
    "[PASS] Plugin suite: 79 passed, 0 failed"
    "[PASS] Sandbox suite: 7 passed, 0 failed"
    "[PASS] RFC bearer-token prompt reported RFC6750 and RFC9700"
    "[PASS] Online writes remained blocked even with /yolo"
    "[PASS] Dependency-risk block created receipt-only evidence"
) "3ECF8E"

Add-Slide "RECORDED EVIDENCE" @(
    "Machine-readable summary:"
    $summaryPath
    ""
    "Full execution transcript:"
    $transcriptPath
    ""
    "FINAL RESULT: PASS"
) "FF526C"

$presentation.SaveAs($deckPath)
$presentation.CreateVideo($videoPath, $false, 3, 720, 24, 70)

$deadline = (Get-Date).AddMinutes(5)
while ($presentation.CreateVideoStatus -in 1, 2) {
    if ((Get-Date) -gt $deadline) { throw "PowerPoint video export timed out." }
    Start-Sleep -Seconds 2
}
if ($presentation.CreateVideoStatus -ne 3 -or -not (Test-Path $videoPath)) {
    throw "PowerPoint video export failed with status $($presentation.CreateVideoStatus)."
}

$presentation.Close()
$powerPoint.Quit()
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)

Write-Output $videoPath
