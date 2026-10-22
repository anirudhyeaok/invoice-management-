$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$secretNames = @('MONGO_URI', 'NEW_DEMO_PASSWORD')
$previousValues = @{}
foreach ($name in $secretNames) {
  $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Convert-SecureStringToPlainText([Security.SecureString] $secureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
  Write-Host 'This changes the password for the existing admin, manager, and clerk accounts in ap-system-demo.'
  $confirmation = Read-Host 'Type RESET to continue'
  if ($confirmation -cne 'RESET') { throw 'Password reset cancelled.' }

  $uri = (Convert-SecureStringToPlainText (Read-Host 'Paste the Atlas connection string' -AsSecureString)).Trim()
  $parts = $uri -split '\?', 2
  $connectionBase = $parts[0]
  $query = if ($parts.Count -gt 1) { "?$($parts[1])" } else { '' }
  $schemeEnd = $connectionBase.IndexOf('://')
  if ($schemeEnd -lt 0) { throw 'That does not look like a MongoDB connection string.' }
  $authorityAndPath = $connectionBase.Substring($schemeEnd + 3)
  $pathStart = $authorityAndPath.IndexOf('/')
  if ($pathStart -lt 0) {
    $connectionBase = "$connectionBase/ap-system-demo"
  } else {
    $databasePath = $authorityAndPath.Substring($pathStart + 1).TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($databasePath)) {
      $connectionBase = "$($connectionBase.TrimEnd('/'))/ap-system-demo"
    } elseif ($databasePath -eq 'ap-system-demo') {
      $connectionBase = $connectionBase.TrimEnd('/')
    } else {
      throw 'The connection string must target the ap-system-demo database.'
    }
  }
  $env:MONGO_URI = "$connectionBase$query"

  $password = Convert-SecureStringToPlainText (Read-Host 'Enter the new password for all three roles (12+ characters)' -AsSecureString)
  if ($password.Length -lt 12) { throw 'The password must be at least 12 characters.' }
  $confirmationPassword = Convert-SecureStringToPlainText (Read-Host 'Enter the new password again to confirm' -AsSecureString)
  if ($password -cne $confirmationPassword) { throw 'The passwords did not match.' }
  $env:NEW_DEMO_PASSWORD = $password
  $password = $null
  $confirmationPassword = $null

  Push-Location (Join-Path $repoRoot 'server')
  try {
    node .\reset-demo-passwords.js
    if ($LASTEXITCODE -ne 0) { throw "Password reset exited with code $LASTEXITCODE." }
  } finally { Pop-Location }
} finally {
  foreach ($name in $secretNames) {
    [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
  }
  Remove-Variable uri, password, confirmationPassword -ErrorAction SilentlyContinue
}
