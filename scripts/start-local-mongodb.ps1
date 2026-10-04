$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$mongoRoot = Join-Path $projectRoot '.local-mongodb'
$bundledMongodPath = Join-Path $mongoRoot 'mongodb-win32-x86_64-windows-8.0.32\bin\mongod.exe'
$dataPath = Join-Path $mongoRoot 'data'
$logPath = Join-Path $mongoRoot 'mongod.log'

if (Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue) {
  Write-Output 'Local MongoDB is already running on 127.0.0.1:27017.'
  exit 0
}

$mongodPath = $bundledMongodPath
if (-not (Test-Path -LiteralPath $mongodPath)) {
  $installedMongo = Get-Command mongod.exe -ErrorAction SilentlyContinue
  if ($installedMongo) { $mongodPath = $installedMongo.Source }
  else { throw 'MongoDB is not running and mongod.exe was not found. Install MongoDB Community Server, start its local service, or add mongod.exe to PATH.' }
}

New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
$arguments = "--dbpath `"$dataPath`" --bind_ip 127.0.0.1 --port 27017 --logpath `"$logPath`" --logappend"
$process = Start-Process -FilePath $mongodPath -ArgumentList $arguments -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  Start-Sleep -Seconds 1
  if (Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Output 'Local MongoDB is running on 127.0.0.1:27017.'
    exit 0
  }
  $process.Refresh()
  if ($process.HasExited) {
    Get-Content -LiteralPath $logPath -Tail 25 -ErrorAction SilentlyContinue
    throw "MongoDB exited before becoming ready (exit code $($process.ExitCode))."
  }
}

throw 'MongoDB did not start within 30 seconds. Check .local-mongodb/mongod.log.'
