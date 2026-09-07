<#
.SYNOPSIS
  Converts every .heic under a folder to .jpg using Windows' built-in HEIF codec, honouring the
  EXIF orientation, then removes the .heic (the iCloud original is untouched).

.EXAMPLE
  powershell -File scripts/convert-heic.ps1 -Root guideless_photos/_library [-Quality 0.9] [-KeepHeic]

.NOTES
  Needs the "HEIF Image Extensions" (and HEVC) from the Microsoft Store, which iCloud for Windows
  installs. sharp cannot decode HEIC on this machine, hence PowerShell + WinRT.
#>
param(
  [Parameter(Mandatory = $true)][string]$Root,
  [double]$Quality = 0.9,
  [switch]$KeepHeic
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]

function Await($op, $type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
function AwaitAction($op) {
  $task = $asTaskAction.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
}

$rootPath = (Resolve-Path $Root).Path
$files = Get-ChildItem -Path $rootPath -Recurse -File -Filter *.heic
Write-Host "$($files.Count) HEIC file(s) under $rootPath"
$ok = 0; $failed = 0

foreach ($f in $files) {
  $target = [System.IO.Path]::ChangeExtension($f.FullName, ".jpg")
  if (Test-Path $target) { if (-not $KeepHeic) { Remove-Item $f.FullName -Force }; $ok++; continue }
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $inStream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($inStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync(
        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
        [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore,
        $transform,
        [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation,
        [Windows.Graphics.Imaging.ColorManagementMode]::ColorManageToSRgb)) ([Windows.Graphics.Imaging.SoftwareBitmap])

    $outStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $props = New-Object Windows.Graphics.Imaging.BitmapPropertySet
    $q = New-Object Windows.Graphics.Imaging.BitmapTypedValue -ArgumentList ([single]$Quality), ([Windows.Foundation.PropertyType]::Single)
    $props.Add("ImageQuality", $q)
    $encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId, $outStream, $props)) ([Windows.Graphics.Imaging.BitmapEncoder])
    $encoder.SetSoftwareBitmap($bitmap)
    AwaitAction ($encoder.FlushAsync())

    $outStream.Seek(0)
    $reader = New-Object Windows.Storage.Streams.DataReader -ArgumentList $outStream
    $size = [uint32]$outStream.Size
    Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
    $bytes = New-Object byte[] $size
    $reader.ReadBytes($bytes)
    [System.IO.File]::WriteAllBytes($target, $bytes)
    $reader.Dispose(); $outStream.Dispose(); $inStream.Dispose(); $bitmap.Dispose()
    if (-not $KeepHeic) { Remove-Item $f.FullName -Force }
    $ok++
    if ($ok % 25 -eq 0) { Write-Host "  …$ok converted" }
  } catch {
    $failed++
    Write-Warning "Failed: $($f.Name) — $($_.Exception.Message.Substring(0, [Math]::Min(120, $_.Exception.Message.Length)))"
  }
}
Write-Host "Converted $ok, failed $failed."
