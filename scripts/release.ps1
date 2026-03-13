param(
  [Parameter(Mandatory = $true)]
  [string]$CommitMessage,

  [string]$GitRemote = "origin",
  [string]$GitBranch = "",

  [string]$DockerHubImage = "johnkimble/kimbles-rte-player",
  [string]$GhcrImage = "ghcr.io/johnkimble/kimbles-rte-player",

  [string]$Version = "",
  [switch]$TagRelease,

  # Opt-in targets -- if none supplied, interactive menu is shown
  [switch]$Git,
  [switch]$DockerHub,
  [switch]$Ghcr,

  # Fine-grained overrides
  [switch]$SkipGit,
  [switch]$SkipDockerBuild,
  [switch]$SkipDockerHubPush,
  [switch]$SkipGhcrPush,
  [switch]$SkipLatestTag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Interactive toggle menu ───────────────────────────────────────────────────
function Show-ToggleMenu {
  param(
    [bool[]]$States,
    [string[]]$Labels
  )

  $selected = 0
  $done = $false
  [Console]::CursorVisible = $false
  $startLine = [Console]::CursorTop

  while (-not $done) {
    [Console]::SetCursorPosition(0, $startLine)
    Write-Host "  Select targets  (W/S move  Space toggle  Enter confirm  Esc cancel)" -ForegroundColor DarkGray
    Write-Host ""

    for ($i = 0; $i -lt $Labels.Count; $i++) {
      $on     = $States[$i]
      $check  = if ($on) { '[X]' } else { '[ ]' }
      $cursor = if ($i -eq $selected) { '>' } else { ' ' }
      if ($i -eq $selected) {
        Write-Host "  $cursor $check  $($Labels[$i])" -ForegroundColor Yellow
      } elseif ($on) {
        Write-Host "  $cursor $check  $($Labels[$i])" -ForegroundColor Green
      } else {
        Write-Host "  $cursor $check  $($Labels[$i])" -ForegroundColor Gray
      }
    }

    Write-Host ""
    Write-Host "  1=Git  2=DockerHub  3=GHCR  A=All  N=None" -ForegroundColor DarkGray

    $key = [Console]::ReadKey($true)

    switch ($key.Key) {
      'UpArrow'   { $selected = ($selected - 1 + $Labels.Count) % $Labels.Count }
      'DownArrow' { $selected = ($selected + 1) % $Labels.Count }
      'Spacebar'  { $States[$selected] = -not $States[$selected] }
      'Enter'     { $done = $true }
      'Escape'    {
        [Console]::CursorVisible = $true
        throw 'Cancelled.'
      }
    }

    switch ($key.KeyChar) {
      'w' { $selected = ($selected - 1 + $Labels.Count) % $Labels.Count }
      's' { $selected = ($selected + 1) % $Labels.Count }
      '1' { $States[0] = -not $States[0] }
      '2' { $States[1] = -not $States[1] }
      '3' { $States[2] = -not $States[2] }
      'a' { for ($i = 0; $i -lt $States.Count; $i++) { $States[$i] = $true  } }
      'A' { for ($i = 0; $i -lt $States.Count; $i++) { $States[$i] = $true  } }
      'n' { for ($i = 0; $i -lt $States.Count; $i++) { $States[$i] = $false } }
      'N' { for ($i = 0; $i -lt $States.Count; $i++) { $States[$i] = $false } }
    }
  }

  [Console]::CursorVisible = $true
  return $States
}

# ── Resolve targets ───────────────────────────────────────────────────────────
$anyOptIn = $Git -or $DockerHub -or $Ghcr

if ($anyOptIn) {
  $doGit       = [bool]$Git
  $doDockerHub = [bool]$DockerHub
  $doGhcr      = [bool]$Ghcr
} else {
  $states = Show-ToggleMenu -States @($true, $true, $true) -Labels @("Git  ($GitRemote)", 'Docker Hub', 'GHCR')
  $doGit       = $states[0]
  $doDockerHub = $states[1]
  $doGhcr      = $states[2]
}

if ($SkipGit)           { $doGit       = $false }
if ($SkipDockerHubPush) { $doDockerHub = $false }
if ($SkipGhcrPush)      { $doGhcr      = $false }

$doDockerBuild = ($doDockerHub -or $doGhcr) -and -not $SkipDockerBuild

# ── Helpers ───────────────────────────────────────────────────────────────────
function Get-TrimmedOutput {
  param([AllowNull()][string]$Value)
  return ([string]$Value).Trim()
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command
  )
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  Write-Host "    $Command"
  Invoke-Expression $Command
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$CommandName' is not installed or not in PATH."
  }
}

function Normalize-VersionTag {
  param([string]$Value)
  $raw = ''
  if (-not [string]::IsNullOrWhiteSpace($Value)) { $raw = $Value.Trim() }
  if (-not $raw) { return '' }
  if ($raw.StartsWith('v')) { return $raw }
  return "v$raw"
}

function Get-DefaultVersionTag {
  $pkgPath = Join-Path $PSScriptRoot '..\package.json'
  if (-not (Test-Path $pkgPath)) { return '' }
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if ($null -eq $pkg.version) { return '' }
  return Normalize-VersionTag -Value ([string]$pkg.version)
}

# ── Validation ────────────────────────────────────────────────────────────────
Require-Command -CommandName 'git'
if ($doDockerBuild) { Require-Command -CommandName 'docker' }

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$resolvedBranch = if ([string]::IsNullOrWhiteSpace($GitBranch)) {
  Get-TrimmedOutput -Value (git branch --show-current)
} else {
  Get-TrimmedOutput -Value $GitBranch
}
if (-not $resolvedBranch) {
  throw 'Could not determine git branch. Pass -GitBranch explicitly.'
}

$resolvedVersionTag = Normalize-VersionTag -Value $Version
if ($TagRelease -and -not $resolvedVersionTag) {
  $resolvedVersionTag = Get-DefaultVersionTag
}

$dockerHubImage = $DockerHubImage.Trim().ToLowerInvariant()
$ghcrImage      = $GhcrImage.Trim().ToLowerInvariant()
if ($doDockerHub -and -not $dockerHubImage) { throw 'DockerHubImage cannot be empty.' }
if ($doGhcr      -and -not $ghcrImage)      { throw 'GhcrImage cannot be empty.' }

$verDisplay = if ([string]::IsNullOrWhiteSpace($resolvedVersionTag)) { '(none)' } else { $resolvedVersionTag }

Write-Host ""
Write-Host 'Release plan' -ForegroundColor Green
Write-Host "  Git        : $(if ($doGit) { 'yes' } else { 'skip' })  ($GitRemote / $resolvedBranch)"
Write-Host "  Docker Hub : $(if ($doDockerHub) { 'yes' } else { 'skip' })  ($dockerHubImage)"
Write-Host "  GHCR       : $(if ($doGhcr) { 'yes' } else { 'skip' })  ($ghcrImage)"
Write-Host "  Version    : $verDisplay"

if (-not $doGit -and -not $doDockerHub -and -not $doGhcr) {
  Write-Host ""
  Write-Host 'Nothing to do -- all targets disabled.' -ForegroundColor Yellow
  exit 0
}

# ── Git ───────────────────────────────────────────────────────────────────────
if ($doGit) {
  Invoke-Step -Name 'Git add' -Command 'git add -A'

  $hasStaged = Get-TrimmedOutput -Value (git diff --cached --name-only)
  if ($hasStaged) {
    Invoke-Step -Name 'Git commit' -Command "git commit -m `"$CommitMessage`""
  } else {
    Write-Host ""
    Write-Host '==> Git commit' -ForegroundColor Cyan
    Write-Host '    No staged changes. Skipping commit.'
  }

  Invoke-Step -Name 'Git push' -Command "git push $GitRemote $resolvedBranch"

  if ($TagRelease -and $resolvedVersionTag) {
    $tagExists = Get-TrimmedOutput -Value (git tag --list $resolvedVersionTag)
    if ($tagExists) {
      Write-Host ""
      Write-Host '==> Git tag' -ForegroundColor Cyan
      Write-Host "    Tag $resolvedVersionTag already exists. Skipping."
    } else {
      Invoke-Step -Name 'Git tag' -Command "git tag $resolvedVersionTag"
    }
    Invoke-Step -Name 'Git push tag' -Command "git push $GitRemote $resolvedVersionTag"
  }
}

# ── Docker build ──────────────────────────────────────────────────────────────
if ($doDockerBuild) {
  $tagArgs = @()
  if (-not $SkipLatestTag) {
    if ($doDockerHub) { $tagArgs += "-t ${dockerHubImage}:latest" }
    if ($doGhcr)      { $tagArgs += "-t ${ghcrImage}:latest" }
  }
  if ($resolvedVersionTag) {
    if ($doDockerHub) { $tagArgs += "-t ${dockerHubImage}:$resolvedVersionTag" }
    if ($doGhcr)      { $tagArgs += "-t ${ghcrImage}:$resolvedVersionTag" }
  }
  if ($tagArgs.Count -eq 0) {
    throw 'No Docker tags to build. Remove -SkipLatestTag or provide -Version.'
  }
  Invoke-Step -Name 'Docker build' -Command "docker build $($tagArgs -join ' ') ."
}

# ── Docker Hub push ───────────────────────────────────────────────────────────
if ($doDockerHub) {
  if (-not $SkipLatestTag) {
    Invoke-Step -Name 'Push Docker Hub latest' -Command "docker push ${dockerHubImage}:latest"
  }
  if ($resolvedVersionTag) {
    Invoke-Step -Name 'Push Docker Hub version' -Command "docker push ${dockerHubImage}:$resolvedVersionTag"
  }
}

# ── GHCR push ─────────────────────────────────────────────────────────────────
if ($doGhcr) {
  if (-not $SkipLatestTag) {
    Invoke-Step -Name 'Push GHCR latest' -Command "docker push ${ghcrImage}:latest"
  }
  if ($resolvedVersionTag) {
    Invoke-Step -Name 'Push GHCR version' -Command "docker push ${ghcrImage}:$resolvedVersionTag"
  }
}

Write-Host ""
Write-Host 'Release complete.' -ForegroundColor Green
