' SerchTube Music - arranque silencioso para el autoinicio de Windows
' Lo usa (y recrea) scripts\start-serchtube.ps1. No hace falta abrirlo a mano.
Option Explicit
Dim fso, sh, raiz, ps1, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
' ...\<proyecto>\scripts\start-serchtube-silencioso.vbs -> dos niveles arriba = raiz
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
ps1  = raiz & "\scripts\start-serchtube.ps1"
If Not fso.FileExists(ps1) Then WScript.Quit 1
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -AutoInicio"
sh.Run cmd, 0, False
