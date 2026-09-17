$ErrorActionPreference = 'Stop'
$deck = Join-Path $PSScriptRoot 'Agent-Airlock-Team-Showcase.pptx'
$pdf = Join-Path $PSScriptRoot 'Agent-Airlock-Team-Showcase.pdf'
$preview = Join-Path $PSScriptRoot 'preview'
if (!(Test-Path -LiteralPath $deck)) { throw 'Build the presentation before rendering it.' }
$validation = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deck-validation.json') -Raw | ConvertFrom-Json
$expectedSlides = [int]$validation.slideCount
New-Item -ItemType Directory -Force -Path $preview | Out-Null
Get-ChildItem -LiteralPath $preview -Filter 'Slide*.PNG' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -LiteralPath $preview -Filter 'contact-sheet-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force

$alreadyRunning = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$application = $null
$presentation = $null
$issues = [Collections.Generic.List[object]]::new()
try {
    $application = New-Object -ComObject PowerPoint.Application
    $presentation = $application.Presentations.Open($deck, -1, 0, 0)
    if ($presentation.Slides.Count -ne $expectedSlides) { throw "Expected $expectedSlides slides, found $($presentation.Slides.Count)." }
    $presentation.Export($preview, 'PNG', 1600, 900)
    $presentation.SaveAs($pdf, 32)
    foreach ($slide in $presentation.Slides) {
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame2.HasText -eq -1) {
                $frame = $shape.TextFrame2
                $range = $frame.TextRange
                $availableHeight = $shape.Height - $frame.MarginTop - $frame.MarginBottom
                $availableWidth = $shape.Width - $frame.MarginLeft - $frame.MarginRight
                if ($range.BoundHeight -gt $availableHeight + 2 -or $range.BoundWidth -gt $availableWidth + 2) {
                    $value = $range.Text
                    $issues.Add([pscustomobject]@{
                        slide = $slide.SlideIndex
                        name = $shape.Name
                        text = $value.Substring(0, [Math]::Min(90, $value.Length))
                        boundHeight = [Math]::Round($range.BoundHeight, 2)
                        availableHeight = [Math]::Round($availableHeight, 2)
                        boundWidth = [Math]::Round($range.BoundWidth, 2)
                        availableWidth = [Math]::Round($availableWidth, 2)
                    })
                }
            }
        }
    }
} finally {
    if ($null -ne $presentation) {
        $presentation.Close()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
    }
    if ($null -ne $application) {
        if (!$alreadyRunning -and $application.Presentations.Count -eq 0) { $application.Quit() }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($application)
    }
}

ConvertTo-Json -InputObject @($issues.ToArray()) -Depth 4 |
    Set-Content -LiteralPath (Join-Path $preview 'text-overflow.json') -Encoding utf8
Add-Type -AssemblyName System.Drawing
$files = @(Get-ChildItem -LiteralPath $preview -Filter 'Slide*.PNG' | Sort-Object { [int]([regex]::Match($_.BaseName, '\d+').Value) })
if ($files.Count -ne $expectedSlides) { throw "Expected $expectedSlides rendered images, found $($files.Count)." }
for ($offset = 0; $offset -lt $files.Count; $offset += 6) {
    $canvas = [Drawing.Bitmap]::new(1280, 1080)
    $graphics = [Drawing.Graphics]::FromImage($canvas)
    try {
        $graphics.Clear([Drawing.Color]::FromArgb(11, 18, 32))
        for ($index = 0; $index -lt 6 -and $offset + $index -lt $files.Count; $index++) {
            $image = [Drawing.Image]::FromFile($files[$offset + $index].FullName)
            try {
                $graphics.DrawImage($image, ($index % 2) * 640, [Math]::Floor($index / 2) * 360, 640, 360)
            } finally { $image.Dispose() }
        }
        $name = 'contact-sheet-{0:D2}.png' -f (1 + [int]($offset / 6))
        $canvas.Save((Join-Path $preview $name), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $canvas.Dispose()
    }
}
Write-Output "Rendered $expectedSlides slides and PDF. Text overflow candidates: $($issues.Count)"
if ($issues.Count -gt 0) {
    $issues | Format-Table -AutoSize | Out-String | Write-Output
    throw 'Inspect and resolve the text overflow candidates before delivery.'
}
