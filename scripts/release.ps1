param(
  [Parameter(Mandatory = $true)]
  [string]$CommitMessage,

  [string]$GitRemote = "origin",
  [string]$GitBranch = "",

  [string]$DockerHubImage = "johnkimble/kimbles-rte-player",
  [string]$GhcrImage = "ghcr.io/johnkimble/kimbles-rte-player",

  [string]$Version = "",
  [switch]$TagRelease,

  [switch]$SkipGit,
  [switch]$SkipDockerBuild,
  [switch]$SkipDockerHubPush,
  [switch]$SkipGhcrPush,
  [switch]$SkipLatestTag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
  $raw = ""
  if (-not [string]::IsNullOrWhiteSpace($Value)) {
    $raw = $Value.Trim()
  }
  if (-not $raw) { return "" }
  if ($raw.StartsWith("v")) { return $raw }
  return "v$raw"
}

function Get-DefaultVersionTag {
  $pkgPath = Join-Path $PSScriptRoot "..\package.json"
  if (-not (Test-Path $pkgPath)) {
    return ""
  }
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if ($null -eq $pkg.version) {
    return ""
  }
  return Normalize-VersionTag -Value ([string]$pkg.version)
}

Require-Command -CommandName "git"
Require-Command -CommandName "docker"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$resolvedBranch = if ([string]::IsNullOrWhiteSpace($GitBranch)) {
  Get-TrimmedOutput -Value (git branch --show-current)
} else {
  Get-TrimmedOutput -Value $GitBranch
}
if (-not $resolvedBranch) {
  throw "Could not determine git branch. Pass -GitBranch explicitly."
}

$resolvedVersionTag = Normalize-VersionTag -Value $Version
if ($TagRelease -and -not $resolvedVersionTag) {
  $resolvedVersionTag = Get-DefaultVersionTag
}

$dockerHubImage = $DockerHubImage.Trim().ToLowerInvariant()
$ghcrImage = $GhcrImage.Trim().ToLowerInvariant()
if (-not $dockerHubImage) { throw "DockerHubImage cannot be empty." }
if (-not $ghcrImage) { throw "GhcrImage cannot be empty." }

Write-Host "Release plan" -ForegroundColor Green
Write-Host "  Git remote/branch : $GitRemote / $resolvedBranch"
Write-Host "  Docker Hub image  : $dockerHubImage"
Write-Host "  GHCR image        : $ghcrImage"
$resolvedVersionDisplay = "(none)"
if (-not [string]::IsNullOrWhiteSpace($resolvedVersionTag)) {
  $resolvedVersionDisplay = $resolvedVersionTag
}
Write-Host "  Version tag       : $resolvedVersionDisplay"
Write-Host "  Tag release       : $TagRelease"

if (-not $SkipGit) {
  Invoke-Step -Name "Git add" -Command "git add -A"

  $hasStaged = Get-TrimmedOutput -Value (git diff --cached --name-only)
  if ($hasStaged) {
    Invoke-Step -Name "Git commit" -Command "git commit -m `"$CommitMessage`""
  } else {
    Write-Host ""
    Write-Host "==> Git commit" -ForegroundColor Cyan
    Write-Host "    No staged changes. Skipping commit."
  }

  Invoke-Step -Name "Git push" -Command "git push $GitRemote $resolvedBranch"

  if ($TagRelease -and $resolvedVersionTag) {
    $tagExists = Get-TrimmedOutput -Value (git tag --list $resolvedVersionTag)
    if ($tagExists) {
      Write-Host ""
      Write-Host "==> Git tag" -ForegroundColor Cyan
      Write-Host "    Tag $resolvedVersionTag already exists. Skipping tag creation."
    } else {
      Invoke-Step -Name "Git tag" -Command "git tag $resolvedVersionTag"
    }
    Invoke-Step -Name "Git push tag" -Command "git push $GitRemote $resolvedVersionTag"
  }
}

if (-not $SkipDockerBuild) {
  $tagArgs = @()
  if (-not $SkipLatestTag) {
    $tagArgs += "-t $dockerHubImage`:latest"
    $tagArgs += "-t $ghcrImage`:latest"
  }
  if ($resolvedVersionTag) {
    $tagArgs += "-t $dockerHubImage`:$resolvedVersionTag"
    $tagArgs += "-t $ghcrImage`:$resolvedVersionTag"
  }
  if ($tagArgs.Count -eq 0) {
    throw "No Docker tags to build. Remove -SkipLatestTag or provide -Version."
  }
  $joinedTags = ($tagArgs -join " ")
  Invoke-Step -Name "Docker build" -Command "docker build $joinedTags ."
}

if (-not $SkipDockerHubPush) {
  if (-not $SkipLatestTag) {
    Invoke-Step -Name "Push Docker Hub latest" -Command "docker push $dockerHubImage`:latest"
  }
  if ($resolvedVersionTag) {
    Invoke-Step -Name "Push Docker Hub version" -Command "docker push $dockerHubImage`:$resolvedVersionTag"
  }
}

if (-not $SkipGhcrPush) {
  if (-not $SkipLatestTag) {
    Invoke-Step -Name "Push GHCR latest" -Command "docker push $ghcrImage`:latest"
  }
  if ($resolvedVersionTag) {
    Invoke-Step -Name "Push GHCR version" -Command "docker push $ghcrImage`:$resolvedVersionTag"
  }
}

Write-Host ""
Write-Host "Release complete." -ForegroundColor Green
