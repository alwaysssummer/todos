# OpenDir Protocol Handler (PowerShell)
# 한글 경로 + 공백 경로 지원

Add-Type -AssemblyName System.Web

# 인자 받기
$url = $args[0]

# opendir:// 접두사 제거
$path = $url -replace '^opendir://', ''

# URL 디코딩 (한글 복원)
$path = [System.Web.HttpUtility]::UrlDecode($path)

# 슬래시를 역슬래시로 변환
$path = $path -replace '/', '\'

# 드라이브 문자 수정: D\ → D:\
$path = $path -replace '^([A-Za-z])\\', '$1:\'

# 폴더 열기
Invoke-Item $path
