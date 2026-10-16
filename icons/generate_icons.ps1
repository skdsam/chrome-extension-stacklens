Add-Type -AssemblyName System.Drawing

$destDir = "d:\scratch\Chrome extension new\icons"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Background circle
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(99, 102, 241))
    $g.FillEllipse($brush, 0, 0, $size, $size)

    # Inner lens ring
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.0, [double]($size / 10)))
    $offset = [int]($size * 0.22)
    $diameter = [int]($size * 0.56)
    $g.DrawEllipse($pen, $offset, $offset, $diameter, $diameter)

    $filePath = Join-Path $destDir "icon$size.png"
    $bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)

    $brush.Dispose()
    $pen.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

Write-Output "Successfully generated icons."
