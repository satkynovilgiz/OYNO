Add-Type -AssemblyName System.Drawing

# Crops W x H from (X,Y) and saves at a SCALE multiple of the crop's own
# size (never a different aspect ratio) - the app displays every one of
# these via resizeMode="cover", which crops-to-fill at render time, so the
# only distortion risk is stretching during THIS script's own resize step.
function CropScaleSave {
    param(
        [string]$SrcPath,
        [int]$X, [int]$Y, [int]$W, [int]$H,
        [string]$DestPath,
        [double]$Scale = 1.0,
        [string]$Format = "Jpeg"
    )
    $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SrcPath))
    $cropRect = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
    $cropped = $src.Clone($cropRect, $src.PixelFormat)
    $outW = [int]([Math]::Round($W * $Scale))
    $outH = [int]([Math]::Round($H * $Scale))
    if ($Scale -eq 1.0) {
        $out = $cropped
    } else {
        $out = New-Object System.Drawing.Bitmap($outW, $outH)
        $g = [System.Drawing.Graphics]::FromImage($out)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.DrawImage($cropped, 0, 0, $outW, $outH)
        $g.Dispose()
    }
    $destDir = Split-Path $DestPath -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    if ($Format -eq "Jpeg") {
        $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
        $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
        $out.Save($DestPath, $encoder, $encParams)
    } else {
        $out.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    if ($Scale -ne 1.0) { $out.Dispose() }
    $cropped.Dispose(); $src.Dispose()
    Write-Output ("Saved: " + $DestPath + " (" + $outW + "x" + $outH + ")")
}

$SRC = "assets/img/OYNO_design"

# ===== Kyrgyz Traditional Games Collection.png (1536x1024, clean 2x2, no gap) =====
$games = "$SRC/Kyrgyz Traditional Games Collection.png"
CropScaleSave -SrcPath $games -X 0 -Y 0 -W 768 -H 512 -DestPath "assets/img/games/chuko/thumbnail.png" -Scale 0.5 -Format Png
CropScaleSave -SrcPath $games -X 768 -Y 0 -W 768 -H 512 -DestPath "assets/img/games/ordo/thumbnail.png" -Scale 0.5 -Format Png
CropScaleSave -SrcPath $games -X 0 -Y 512 -W 768 -H 512 -DestPath "assets/img/games/zhaaAtuu/thumbnail.png" -Scale 0.5 -Format Png
CropScaleSave -SrcPath $games -X 768 -Y 512 -W 768 -H 512 -DestPath "assets/img/games/kyzKuumay/thumbnail.png" -Scale 0.5 -Format Png

# ===== Kyrgyz Heritage in Four Seasons.png (1536x1024, 2x2, border gap ~500-524/756-778) =====
$seasons = "$SRC/Kyrgyz Heritage in Four Seasons.png"
CropScaleSave -SrcPath $seasons -X 0 -Y 0 -W 756 -H 500 -DestPath "$SRC/culture/clothing/ak_kalpak_closeup.jpg" -Scale 1.0 -Format Jpeg
CropScaleSave -SrcPath $seasons -X 0 -Y 524 -W 756 -H 500 -DestPath "$SRC/culture/horse/kok_boru_action.jpg" -Scale 1.0 -Format Jpeg

# ===== Yurts and Heritage Carpets at Golden Hour.png (1536x1024, stacked, gap ~500-514) =====
$yurts = "$SRC/Yurts and Heritage Carpets at Golden Hour.png"
# Top: yurt golden hour, full width landscape band -> boz_uy/yurt_camp.jpg
# (display box is landscape 220x160 - the OLD file was portrait 1280x1707,
# a poor fit; this landscape crop is a genuine improvement, not just a swap)
CropScaleSave -SrcPath $yurts -X 0 -Y 0 -W 1536 -H 499 -DestPath "$SRC/culture/boz_uy/yurt_camp.jpg" -Scale 0.83 -Format Jpeg
# Bottom: shyrdak pattern - crop a centered square-ish slice (aspect 1.333)
# out of the wide bottom panel instead of stretching the whole band.
CropScaleSave -SrcPath $yurts -X 429 -Y 515 -W 679 -H 509 -DestPath "$SRC/culture/shyrdak/colors_pattern.jpg" -Scale 1.0 -Format Jpeg

# ===== Kyrgyz Heritage Gallery.png (1214x1295, 5-cell, gaps at y~432-453/798-816, x~596-618) =====
$gallery = "$SRC/Kyrgyz Heritage Gallery.png"
# Row1 Right: horse + eagle (berkutchi), new horse-overview gallery image
CropScaleSave -SrcPath $gallery -X 622 -Y 0 -W 592 -H 428 -DestPath "$SRC/culture/horse/berkutchi_eagle.jpg" -Scale 1.0 -Format Jpeg
# Row2 food spread: crop a centered slice matching cat_food.png's own aspect
# (144x105 = 1.371) out of the full-width row instead of stretching it.
CropScaleSave -SrcPath $gallery -X 378 -Y 458 -W 459 -H 335 -DestPath "$SRC/culture/cat_food.png" -Scale 1.0 -Format Png
# Row3 Left: ordo/toguz board with yurts - crop a centered slice matching
# cat_games.png's own aspect (144x105 = 1.371).
CropScaleSave -SrcPath $gallery -X 28 -Y 820 -W 535 -H 390 -DestPath "$SRC/culture/cat_games.png" -Scale 1.0 -Format Png

# ===== Komuz.png (1536x1024, single image, aspect 1.5) =====
$komuz = "$SRC/Komuz.png"
# Full frame -> cat_komuz.png (existing 144x96 is exactly aspect 1.5 too)
CropScaleSave -SrcPath $komuz -X 0 -Y 0 -W 1536 -H 1024 -DestPath "$SRC/culture/cat_komuz.png" -Scale 0.31 -Format Png
# Wide band -> home tile_music_komuz.png (existing 500x206 = aspect 2.427)
CropScaleSave -SrcPath $komuz -X 0 -Y 196 -W 1536 -H 633 -DestPath "$SRC/home/tile_music_komuz.png" -Scale 0.65 -Format Png

# ===== Kyrgyz Pastry Feast in Warm Sunlight.png (1672x941, single image) =====
$pastry = "$SRC/Kyrgyz Pastry Feast in Warm Sunlight.png"
# Wide band -> home tile_food_plov.png (existing 500x207 = aspect 2.415)
CropScaleSave -SrcPath $pastry -X 0 -Y 108 -W 1672 -H 692 -DestPath "$SRC/home/tile_food_plov.png" -Scale 0.6 -Format Png
# Tighter square-ish crop -> material_boorsok.png (existing 170x102 = aspect 1.667)
CropScaleSave -SrcPath $pastry -X 240 -Y 60 -W 1200 -H 720 -DestPath "$SRC/culture/material_boorsok.png" -Scale 0.42 -Format Png

Write-Output "DONE"
