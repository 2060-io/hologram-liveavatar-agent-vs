# PowerShell script to start VS Agent Docker container
# Usage: .\scripts\docker-run.ps1 <ngrok-subdomain>

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokSubdomain
)

$PublicUrl = "https://${NgrokSubdomain}.ngrok-free.app"
$BotServerUrl = $PublicUrl

Write-Host "🐳 Starting VS Agent container..." -ForegroundColor Cyan
Write-Host "📡 Public URL: $PublicUrl" -ForegroundColor Green
Write-Host "🤖 Bot Server: $BotServerUrl" -ForegroundColor Green

docker run -it --rm `
    --name vs-agent `
    -p 3000:3000 `
    -e PUBLIC_BASE_URL="$PublicUrl" `
    -e MESSAGE_RECEIVED_URL="$BotServerUrl/message-received" `
    -e CONNECTION_ESTABLISHED_URL="$BotServerUrl/connection-established" `
    -e CALL_ESTABLISHED_URL="$BotServerUrl/call-established" `
    -e VERIFIABLE_INFO_RECEIVED_URL="$BotServerUrl/verifiable-info-received" `
    -e PROFILE_URL="$BotServerUrl/logo.png" `
    -e SERVICE_NAME="LiveAvatar Agent" `
    -e SERVICE_DESCRIPTION="Live AI Avatar powered by HeyGen" `
    ghcr.io/2060-io/vs-agent:latest

Write-Host "🛑 VS Agent stopped" -ForegroundColor Yellow
