/**
 * Version and build information
 * This file provides version metadata for the application
 */

import packageJson from '../../package.json';

export interface VersionInfo {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildTime: string;
  environment: string;
  nextVersion: string;
}

/**
 * Get application version information
 * Uses environment variables set during build time
 */
export function getVersionInfo(): VersionInfo {
  return {
    version: packageJson.version,
    gitCommit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 
               process.env.GIT_COMMIT || 
               'unknown',
    gitBranch: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || 
               process.env.GIT_BRANCH || 
               'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 
               new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nextVersion: '15.5.4'
  };
}

/**
 * Get short git commit hash (first 7 chars)
 */
export function getShortCommitHash(): string {
  const info = getVersionInfo();
  return info.gitCommit.substring(0, 7);
}

/**
 * Format build time as readable string
 */
export function getFormattedBuildTime(): string {
  const info = getVersionInfo();
  try {
    const date = new Date(info.buildTime);
    return date.toLocaleString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return info.buildTime;
  }
}

/**
 * Check if running in production
 */
export function isProductionBuild(): boolean {
  return getVersionInfo().environment === 'production';
}

