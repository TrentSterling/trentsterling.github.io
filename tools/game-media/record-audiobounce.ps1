param(
    [string]$Unity = 'C:/Program Files/Unity/Hub/Editor/6000.0.65f1/Editor/Unity.exe'
)
$ErrorActionPreference = 'Stop'
$siteRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$captureRoot = Join-Path $siteRoot '.local/native/audiobounce'
Push-Location $siteRoot
try {
    python tools/game-media/prepare-audiobounce.py
    if ($LASTEXITCODE -ne 0) { throw 'AudioBounce staging failed' }
    $captureArguments = @(
        '-batchmode', '-force-d3d11',
        '-projectPath', ('"' + (Join-Path $captureRoot 'project') + '"'),
        '-executeMethod', 'AudioBounceCaptureBatch.Run',
        '-logFile', ('"' + (Join-Path $captureRoot 'unity-capture.log') + '"')
    )
    $captureProcess = Start-Process -FilePath $Unity -ArgumentList $captureArguments -WindowStyle Hidden -PassThru
    $captureProcess.Id | Set-Content -LiteralPath (Join-Path $captureRoot 'unity-capture.pid')
    $captureProcess.WaitForExit()
    if ($captureProcess.ExitCode -ne 0) { throw ('Unity capture failed: ' + $captureProcess.ExitCode) }
    ffmpeg -v error -nostdin -y -framerate 60 -i (Join-Path $captureRoot 'frames-raised-bugs/%05d.jpg') -an -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -movflags +faststart (Join-Path $captureRoot 'audiobounce-demo.mp4')
    if ($LASTEXITCODE -ne 0) { throw 'Master encoding failed' }
    python tools/game-media/audit-audiobounce.py
    if ($LASTEXITCODE -ne 0) { throw 'AudioBounce capture audit failed' }
} finally {
    Pop-Location
}
