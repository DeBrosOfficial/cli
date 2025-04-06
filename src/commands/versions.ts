import { Command } from 'commander';
import { getAppVersions } from '../services/network.js';
import { logger } from '../utils/logger.js';

export function versionsCommand(program: Command) {
  program
    .command('versions')
    .description('List all available versions of an application')
    .argument('<app-name>', 'Application name')
    .action(async (appName) => {
      try {
        const versions = await getAppVersions(appName);
        
        if (versions.length === 0) {
          logger.warn(`No versions found for application ${appName}`);
          return;
        }
        
        logger.info(`Versions for ${appName}:`);
        versions.forEach((version, index) => {
          const isLatest = version.tag === 'latest' ? ' (latest)' : '';
          const isCurrent = version.deployed ? ' (deployed)' : '';
          logger.raw(`${index + 1}. ${version.tag}${isLatest}${isCurrent} - Uploaded: ${version.timestamp}, CID: ${version.cid}`);
        });
        
        logger.success(`
To rollback to a specific version, use:
  debros rollback ${appName} <version-tag>
`);
      } catch (error) {
        logger.error(`Failed to get versions: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}