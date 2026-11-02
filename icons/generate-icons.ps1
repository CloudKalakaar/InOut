Add-Type -AssemblyName System.Drawing

$src  = "E:\AgenticAI\InOut\file_000000006c20820bbf1241cf786592e2.png"
$dest = "E:\AgenticAI\InOut\icons"

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)

$original = [System.Drawing.Image]::FromFile($src)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($original, 0, 0, $size, $size)
    $g.Dispose()

    $outPath = Join-Path $dest "icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $outPath"
}

$original.Dispose()
Write-Host "All icons generated!"
