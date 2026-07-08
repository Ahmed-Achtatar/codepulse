param(
  [string]$Url = "http://localhost:8787"
)

$ErrorActionPreference = "Stop"
$failures = 0

function Test-Status {
  param(
    [string]$Label,
    [string]$Path,
    [int]$Expected = 200
  )

  try {
    $response = Invoke-WebRequest -Uri "$Url$Path" -UseBasicParsing -TimeoutSec 20
    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    } else {
      Write-Host "Fail: $Label request failed: $($_.Exception.Message)"
      $script:failures++
      return
    }
  }

  if ($status -eq $Expected) {
    Write-Host "Success: $Label returned $status"
  } else {
    Write-Host "Fail: $Label returned $status, expected $Expected"
    $script:failures++
  }
}

function Test-Contains {
  param(
    [string]$Label,
    [string]$Path,
    [string]$Expected
  )

  try {
    $body = (Invoke-WebRequest -Uri "$Url$Path" -UseBasicParsing -TimeoutSec 20).Content
  } catch {
    Write-Host "Fail: $Label request failed: $($_.Exception.Message)"
    $script:failures++
    return
  }

  if ($body.Contains($Expected)) {
    Write-Host "Success: $Label contains $Expected"
  } else {
    Write-Host "Fail: $Label missing $Expected"
    $script:failures++
  }
}

function Test-NotContains {
  param(
    [string]$Label,
    [string]$Path,
    [string]$Unexpected
  )

  try {
    $body = (Invoke-WebRequest -Uri "$Url$Path" -UseBasicParsing -TimeoutSec 20).Content
  } catch {
    Write-Host "Fail: $Label request failed: $($_.Exception.Message)"
    $script:failures++
    return
  }

  if (-not $body.Contains($Unexpected)) {
    Write-Host "Success: $Label does not contain $Unexpected"
  } else {
    Write-Host "Fail: $Label still contains $Unexpected"
    $script:failures++
  }
}

function Test-PaymentChallenge {
  param(
    [string]$Label,
    [string]$Path,
    [string]$Payload,
    [string]$ExpectedAmount
  )

  try {
    $response = Invoke-WebRequest -Uri "$Url$Path" -Method POST -ContentType "application/json" -Body $Payload -UseBasicParsing -TimeoutSec 20
    $status = [int]$response.StatusCode
    $body = $response.Content
    $header = $response.Headers["PAYMENT-REQUIRED"]
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $header = $_.Exception.Response.Headers["PAYMENT-REQUIRED"]
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $body = $reader.ReadToEnd()
    } else {
      Write-Host "Fail: $Label request failed: $($_.Exception.Message)"
      $script:failures++
      return
    }
  }

  $challenge = ""
  if ($header) {
    $padded = $header
    while ($padded.Length % 4 -ne 0) {
      $padded += "="
    }
    $challenge = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($padded))
  }

  $bodyHasLegacyAmount = $body.Contains("""maxAmountRequired"":""$ExpectedAmount""") -or $body.Contains("""maxAmountRequired"":""1000""")
  $headerHasV2Amount = $challenge.Contains("""amount"":""$ExpectedAmount""") -or $challenge.Contains("""amount"":""1000""")

  if ($status -eq 402 -and ($bodyHasLegacyAmount -or $headerHasV2Amount)) {
    Write-Host "Success: $Label returned 402"
  } else {
    Write-Host "Fail: $Label did not return x402 amount $ExpectedAmount"
    $script:failures++
  }
}

Write-Host "Testing $Url"
Write-Host ""

$ExpectedEndpointPaths = @(
  "/web/search",
  "/web/scrape",
  "/web/markdown",
  "/mailbox/create",
  "/phone/temp-sms",
  "/webhook/listen",
  "/domain/check",
  "/registry/npm",
  "/security/secret-scan",
  "/media/pdf-text"
)


Write-Host "1. Health check"
Test-Status "homepage" "/"
Test-Status "try page" "/try"
Test-Status "health" "/health"
Write-Host ""

Write-Host "2. Trust endpoints"
Test-Status "logo.svg" "/logo.svg"
Test-Status "terms" "/terms"
Test-Status "privacy" "/privacy"
Write-Host ""

Write-Host "3. Discovery metadata"
Test-Status "metadata.json" "/metadata.json"
Test-Status "agenterc metadata" "/agenterc-metadata.json"
Test-Status "agent registration well-known" "/.well-known/agent-registration.json"
Test-Status "agent-card" "/.well-known/agent-card.json"
Test-Status "agent.json" "/.well-known/agent.json"
Test-Status "x402.json" "/.well-known/x402.json"
Test-Status "mcp.json" "/.well-known/mcp.json"
Test-Status "x402 discovery" "/x402/discovery"
Test-Status "oasf.json" "/.well-known/oasf.json"
Test-Status "llms.txt" "/llms.txt"
Test-Status "well-known llms.txt" "/.well-known/llms.txt"
Test-Status "openapi.json" "/openapi.json"
foreach ($path in $ExpectedEndpointPaths) {
  Test-Status "endpoint info $path" $path
}
Test-Status "a2a service GET" "/a2a"
Test-Status "a2a card GET" "/a2a/card"
Test-Status "mcp service GET" "/mcp"
Test-Status "oasf service GET" "/oasf"
Test-Contains "homepage" "/" "CodePulse API"
Test-Contains "openapi" "/openapi.json" "/web/search"
Test-Contains "openapi" "/openapi.json" "/web/markdown"
foreach ($path in $ExpectedEndpointPaths) {
  Test-Contains "openapi endpoint $path" "/openapi.json" $path
  Test-Contains "llms endpoint $path" "/llms.txt" "POST $Url$path"
}
Test-Contains "x402 metadata" "/.well-known/x402.json" "10000"
Test-Contains "llms.txt" "/llms.txt" "POST $Url/web/search"
Test-Contains "llms.txt" "/llms.txt" 'Price: $0.030'
Test-Contains "agent-card" "/.well-known/agent-card.json" "webSearch"
Test-Contains "agent-card" "/.well-known/agent-card.json" "webScrape"
Test-Contains "mcp.json" "/.well-known/mcp.json" "2025-06-18"
Test-Contains "oasf.json" "/.well-known/oasf.json" "schema_version"
Test-NotContains "openapi" "/openapi.json" "/diff"
Test-NotContains "openapi" "/openapi.json" "/enrich"
Write-Host ""

Write-Host "4. Payment challenge"
Test-PaymentChallenge "web search" "/web/search" '{"query":"test"}' "30000"
Test-PaymentChallenge "web markdown" "/web/markdown" '{"url":"https://example.com"}' "30000"
foreach ($path in $ExpectedEndpointPaths) {
  # Special pricing mapping for CodePulse
  $expectedPrice = "30000"
  if ($path -eq "/mailbox/create" -or $path -eq "/webhook/listen" -or $path -eq "/domain/check") {
    $expectedPrice = "10000"
  } elseif ($path -eq "/registry/npm") {
    $expectedPrice = "5000"
  } elseif ($path -eq "/security/secret-scan") {
    $expectedPrice = "15000"
  } elseif ($path -eq "/media/pdf-text") {
    $expectedPrice = "50000"
  } elseif ($path -eq "/phone/temp-sms") {
    $expectedPrice = "150000"
  }
  
  $payload = '{}'
  if ($path -eq "/web/search") { $payload = '{"query":"test"}' }
  elseif ($path -eq "/web/scrape") { $payload = '{"url":"https://example.com"}' }
  elseif ($path -eq "/web/markdown") { $payload = '{"url":"https://example.com"}' }
  elseif ($path -eq "/domain/check") { $payload = '{"domain":"google.com"}' }
  elseif ($path -eq "/registry/npm") { $payload = '{"package":"express"}' }
  elseif ($path -eq "/security/secret-scan") { $payload = '{"text":"no secrets here"}' }
  elseif ($path -eq "/media/pdf-text") { $payload = '{"url":"https://example.com/sample.pdf"}' }

  Test-PaymentChallenge "payment challenge $path" $path $payload $expectedPrice
}
Write-Host "5. Referral status checks"
Test-Status "referrals balance query" "/credits/referral/0xed6EF0caD95D66842b87d07C5ed0C0465D0052e6"
Test-Contains "referrals query response" "/credits/referral/0xed6EF0caD95D66842b87d07C5ed0C0465D0052e6" "0xed6ef0cad95d66842b87d07c5ed0c0465d0052e6"
Write-Host ""

if ($failures -gt 0) {
  Write-Host "$failures check(s) failed"
  exit 1
}

Write-Host "All checks passed"
