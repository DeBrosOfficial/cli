import { Command } from 'commander';
import { rollbackToVersion } from '../services/network.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export function rollbackCommand(program: Command) {
  program
    .command('rollback')
    .description('Rollback an application to a specific version')
    .argument('<app-name>', 'Application name')
    .argument('[version-tag]', 'Version tag to rollback to (defaults to previous version)')
    .option('-f, --force', 'Force rollback without confirmation')
    .action(async (appName, versionTag, options) => {
      try {
        if (!versionTag) {
          logger.info('No version specified, rolling back to previous deployed version');
        } else {
          logger.info(`Rolling back ${appName} to version ${versionTag}`);
        }
        
        // Get domain
        const domain = `${appName}.${config.defaultDomain}`;
        
        // Perform the rollback
        const result = await rollbackToVersion(appName, versionTag, domain, options.force);
        
        if (result.success) {
          logger.success(`
Application ${appName} successfully rolled back to version ${result.version}!
CID: ${result.cid}
          
The rolled back version is now being redeployed to the network.
It will be accessible at: http://${domain}
`);
        } else {
          logger.error(`Rollback failed: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Failed to rollback: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}