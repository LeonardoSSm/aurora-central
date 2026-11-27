param(
    [Parameter(Mandatory)][string] $InstallerPath,
    [Parameter(Mandatory)][string] $BinaryPath
)

$ErrorActionPreference = 'Stop'
$installer = Get-Item -LiteralPath $InstallerPath
$expected = (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash
$installDir = Join-Path ([IO.Path]::GetTempPath()) ('aurora-central-install-test-' + [guid]::NewGuid().ToString('N'))
$registryPath = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora Central'
$userKey = "HKCU:\$registryPath"
$machineKey = "HKLM:\$registryPath"

if ((Test-Path -LiteralPath $installDir) -or (Test-Path -LiteralPath $userKey) -or (Test-Path -LiteralPath $machineKey)) {
    throw 'O teste exige um ambiente sem instalação anterior do Aurora Central.'
}

$installedApp = Join-Path $installDir 'aurora-central.exe'
$uninstaller = Join-Path $installDir 'uninstall.exe'

try {
    # NSIS exige /D= como último argumento e sem aspas, inclusive em caminhos com espaços.
    $setup = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installDir" -WindowStyle Hidden -Wait -PassThru
    if ($setup.ExitCode -ne 0) { throw "Instalação falhou com código $($setup.ExitCode)." }
    $installed = (Get-FileHash -LiteralPath $installedApp -Algorithm SHA256).Hash
    if ($installed -ne $expected) { throw 'O binário instalado difere do binário compilado.' }
    if (!(Test-Path -LiteralPath $userKey)) { throw 'Instalação por usuário ausente do registro.' }
    if (!(Test-Path -LiteralPath $uninstaller)) { throw 'Desinstalador ausente.' }
} finally {
    if (Test-Path -LiteralPath $uninstaller) {
        $removal = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
        if ($removal.ExitCode -ne 0) { throw "Desinstalação falhou com código $($removal.ExitCode)." }
    }
}

if ((Test-Path -LiteralPath $installedApp) -or (Test-Path -LiteralPath $userKey)) {
    throw 'A desinstalação deixou o aplicativo ou a entrada de instalação.'
}

Write-Output 'Instalação por usuário, integridade do binário e desinstalação verificadas.'
