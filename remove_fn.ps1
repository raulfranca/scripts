$file = 'C:\dev\scripts\1doc\credenciamento\credenciamento.user.js'
$lines = Get-Content $file -Encoding UTF8

$startIdx = -1
$endIdx = -1

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'function mostrarDialogCicloErrado') {
        # Walk back through the docstring to find its opening
        $j = $i - 1
        while ($j -ge 0 -and -not ($lines[$j].Trim() -eq '')) { $j-- }
        $startIdx = $j + 1
        Write-Host "Function at line $($i+1), docstring starts at line $($startIdx+1)"
    }
    if ($lines[$i] -match '^\s+function trocarMarcador') {
        $endIdx = $i - 1  # blank line before trocarMarcador
        Write-Host "trocarMarcador at line $($i+1), endIdx=$($endIdx+1)"
        break
    }
}

Write-Host "startIdx=$($startIdx+1) endIdx=$($endIdx+1) total=$($lines.Length)"

if ($startIdx -ge 0 -and $endIdx -gt $startIdx) {
    $keep = $lines[0..($startIdx-1)] + $lines[$endIdx..($lines.Length-1)]
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($file, $keep, $utf8NoBom)
    Write-Host "Done."
} else {
    Write-Host "ERROR: markers not found."
}
