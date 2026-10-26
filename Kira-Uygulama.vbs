Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
htmlPath = currentDir & "\docs\index.html"
fileUrl = "file:///" & Replace(htmlPath, "\", "/")

' Chrome veya Edge uygulama modunda (adres çubuksuz masaüstü penceresi olarak) aç
On Error Resume Next
WshShell.Run "msedge.exe --app=""" & fileUrl & """ --window-size=1440,900", 1, False
If Err.Number <> 0 Then
    Err.Clear
    WshShell.Run "chrome.exe --app=""" & fileUrl & """ --window-size=1440,900", 1, False
    If Err.Number <> 0 Then
        WshShell.Run """" & htmlPath & """", 1, False
    End If
End If
