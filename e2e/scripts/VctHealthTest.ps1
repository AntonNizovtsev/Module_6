param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Store', 'Run')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [ValidateSet('US', 'EU', 'ASIA', 'LATAM', 'CHINA')]
  [string]$Region
)

$ErrorActionPreference = 'Stop'

if (-not ('VctCredentialManager' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security;

public static class VctCredentialManager
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NativeCredential
    {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public long LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref NativeCredential credential, uint flags);

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr buffer);

    public static void Write(string target, string username, SecureString password)
    {
        IntPtr targetPointer = IntPtr.Zero;
        IntPtr usernamePointer = IntPtr.Zero;
        IntPtr passwordPointer = IntPtr.Zero;
        IntPtr blob = IntPtr.Zero;

        try
        {
            targetPointer = Marshal.StringToHGlobalUni(target);
            usernamePointer = Marshal.StringToHGlobalUni(username);
            passwordPointer = Marshal.SecureStringToGlobalAllocUnicode(password);
            int blobSize = password.Length * 2;
            blob = Marshal.AllocHGlobal(Math.Max(blobSize, 1));

            for (int i = 0; i < blobSize; i += 2)
            {
                Marshal.WriteInt16(blob, i, Marshal.ReadInt16(passwordPointer, i));
            }

            NativeCredential credential = new NativeCredential
            {
                Type = 1,
                TargetName = targetPointer,
                CredentialBlobSize = (uint)blobSize,
                CredentialBlob = blob,
                Persist = 2,
                UserName = usernamePointer
            };

            if (!CredWrite(ref credential, 0))
            {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }
        }
        finally
        {
            if (blob != IntPtr.Zero)
            {
                for (int i = 0; i < password.Length * 2; i++)
                {
                    Marshal.WriteByte(blob, i, 0);
                }
                Marshal.FreeHGlobal(blob);
            }
            if (passwordPointer != IntPtr.Zero) Marshal.ZeroFreeGlobalAllocUnicode(passwordPointer);
            if (usernamePointer != IntPtr.Zero) Marshal.FreeHGlobal(usernamePointer);
            if (targetPointer != IntPtr.Zero) Marshal.FreeHGlobal(targetPointer);
        }
    }

    public static object Read(string target)
    {
        IntPtr buffer;
        if (!CredRead(target, 1, 0, out buffer))
        {
            int error = Marshal.GetLastWin32Error();
            if (error == 1168) return null;
            throw new System.ComponentModel.Win32Exception(error);
        }

        try
        {
            NativeCredential credential = (NativeCredential)Marshal.PtrToStructure(
                buffer, typeof(NativeCredential));
            string username = Marshal.PtrToStringUni(credential.UserName);
            string password = Marshal.PtrToStringUni(
                credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
            return new Tuple<string, string>(username, password);
        }
        finally
        {
            CredFree(buffer);
        }
    }
}
'@
}

$regionName = $Region.ToUpperInvariant()
$urls = @{
  US    = 'https://vctrials.com'
  EU    = 'https://vctrials.eu/'
  ASIA  = 'https://vctrials.asia/'
  LATAM = 'https://vctrialssamerica.com/'
  CHINA = 'https://verifysubject.com/'
}
$target = "VCT.Playwright.$regionName"

if ($Action -eq 'Store') {
  $username = Read-Host "Username for $regionName"
  if ([string]::IsNullOrWhiteSpace($username)) {
    throw 'Username cannot be empty.'
  }
  $password = Read-Host "Password for $regionName (input is hidden)" -AsSecureString
  if ($password.Length -eq 0) {
    throw 'Password cannot be empty.'
  }

  [VctCredentialManager]::Write($target, $username, $password)
  Write-Output "Credentials saved in Windows Credential Manager for $regionName."
  return
}

$credential = [VctCredentialManager]::Read($target)
if ($null -eq $credential) {
  $displayRegion = $regionName
  if ($regionName -eq 'ASIA') { $displayRegion = 'Asia' }
  if ($regionName -eq 'CHINA') { $displayRegion = 'China' }
  $legacyTarget = "VCT Production $displayRegion - $($urls[$regionName].TrimEnd('/'))"
  $credential = [VctCredentialManager]::Read($legacyTarget)
}
if ($null -eq $credential) {
  throw "No credentials found for $regionName. Save them first with: .\scripts\VctHealthTest.ps1 -Action Store -Region $regionName"
}

$confirmation = Read-Host "Health tests send email messages. Run against $regionName production at $($urls[$regionName])? Type Y to continue"
if ($confirmation -cne 'Y') {
  Write-Output 'Health test cancelled.'
  exit 1
}

$playwright = Join-Path $PSScriptRoot '..\node_modules\.bin\playwright.cmd'
if (-not (Test-Path $playwright)) {
  throw 'Playwright dependencies are missing. Run npm ci from the e2e folder first.'
}

$previousBaseUrl = $env:BASE_URL
$previousUsername = $env:TEST_USERNAME
$previousPassword = $env:TEST_PASSWORD
$previousVctUsername = $env:VCT_USERNAME
$previousVctPassword = $env:VCT_PASSWORD
$env:BASE_URL = $urls[$regionName]
$env:TEST_USERNAME = $credential.Item1
$env:TEST_PASSWORD = $credential.Item2
$env:VCT_USERNAME = $credential.Item1
$env:VCT_PASSWORD = $credential.Item2

Push-Location (Join-Path $PSScriptRoot '..')
try {
  & $playwright test --project=setup --grep 'authenticate$'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $arguments = @('test', 'tests/health-test/healthTest.spec.ts', '--project=chromium', '--no-deps')
  & $playwright @arguments
  exit $LASTEXITCODE
}
finally {
  Pop-Location
  $env:BASE_URL = $previousBaseUrl
  $env:TEST_USERNAME = $previousUsername
  $env:TEST_PASSWORD = $previousPassword
  $env:VCT_USERNAME = $previousVctUsername
  $env:VCT_PASSWORD = $previousVctPassword
}
