# OpenFolder PowerShell Script - 창 숨김 버전
param([string]$url)

if ($url -match 'path=(.+)$') {
    $encodedPath = $matches[1]
    $path = [System.Uri]::UnescapeDataString($encodedPath)
    
    # explorer로 폴더 열기
    Start-Process explorer.exe -ArgumentList "`"$path`""
}
