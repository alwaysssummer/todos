' OpenFolder VBScript - 로컬 폴더 열기 (로그 포함)

On Error Resume Next

Dim url, path, shell, pos, fso, logFile

' 로그 파일 생성
Set fso = CreateObject("Scripting.FileSystemObject")
Set logFile = fso.CreateTextFile("D:\DEV_cursor\todos\openfolder_log.txt", True)

If WScript.Arguments.Count > 0 Then
    url = WScript.Arguments(0)
    logFile.WriteLine "받은 URL: " & url
    
    ' "path=" 이후의 문자열 추출
    pos = InStr(url, "path=")
    logFile.WriteLine "path= 위치: " & pos
    
    If pos > 0 Then
        path = Mid(url, pos + 5)
        logFile.WriteLine "추출된 경로 (디코딩 전): " & path
        
        ' URL 디코딩 (일반적인 인코딩 문자들)
        path = Replace(path, "%3A", ":")
        path = Replace(path, "%5C", "\")
        path = Replace(path, "%2F", "/")
        path = Replace(path, "%20", " ")
        path = Replace(path, "%23", "#")
        path = Replace(path, "%26", "&")
        path = Replace(path, "%2B", "+")
        path = Replace(path, "+", " ")
        
        ' 슬래시를 백슬래시로 변환
        path = Replace(path, "/", "\")
        
        logFile.WriteLine "최종 경로: " & path
        
        ' 탐색기로 폴더 열기
        Set shell = CreateObject("WScript.Shell")
        shell.Run "explorer """ & path & """", 1, False
        
        logFile.WriteLine "explorer 실행 완료"
    Else
        logFile.WriteLine "에러: path= 를 찾을 수 없음"
    End If
Else
    logFile.WriteLine "에러: 인자 없음"
End If

logFile.Close
