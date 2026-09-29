$ErrorActionPreference = "Stop"

$repository = "C:\Users\dlingam\.copilot\session-state\c40bcc57-32bd-4614-ace7-51b6bdcd6573\files\airlock-pr-worktree"
$sessionId = [guid]::NewGuid().ToString()

Set-Location -LiteralPath $repository
Write-Host "Starting isolated demo session"
Write-Host "Repository: $repository"
Write-Host "Profile: airlock-demo"
Write-Host "MCP server: airlock-outbound (explicitly enabled)"

agency copilot `
  --session-id $sessionId `
  --profile-only airlock-demo `
  --no-default-mcps `
  -- `
  --enable-mcp-server airlock-outbound

exit $LASTEXITCODE
