' OpenFolder VBScript - 디버그 버전

Dim url, path, pos

If WScript.Arguments.Count > 0 Then
    url = WScript.Arguments(0)
    
    MsgBox "받은 URL: " & url, vbInformation, "디버그 1"
    
    ' "path=" 이후의 문자열 추출
    pos = InStr(url, "path=")
    
    MsgBox "path= 위치: " & pos, vbInformation, "디버그 2"
    
    If pos > 0 Then
        path = Mid(url, pos + 5)
        
        MsgBox "추출된 경로 (디코딩 전): " & path, vbInformation, "디버그 3"
        
        ' URL 디코딩
        path = Replace(path, "%3A", ":")
        path = Replace(path, "%5C", "\")
        path = Replace(path, "%2F", "/")
        path = Replace(path, "%20", " ")
        path = Replace(path, "/", "\")
        
        MsgBox "최종 경로: " & path, vbInformation, "디버그 4"
    Else
        MsgBox "path= 를 찾을 수 없습니다", vbError, "에러"
    End If
Else
    MsgBox "인자가 없습니다", vbError, "에러"
End If

