import { Command } from 'commander';
import { deleteApplication } from '../services/network.js';
import { logger } from '../utils/logger.js';

export function deleteCommand(program: Command) {
  program
    .command('delete')
    .description('Delete an application from the network')
    .argument('<app-name>', 'Application name')
    .option('-f, --force', 'Force delete without confirmation')
    .action(async (appName, options) => {
      try {
        if (!options.force) {
          // If not forcing, we'd typically prompt for confirmation here
          logger.warn(`
WARNING: This will completely remove ${appName} from the network!
All versions will be deleted and cannot be recovered.`);
          logger.info(`Deleting application ${appName}...`);
        } else {
          logger.info(`Force deleting application ${appName}...`);
        }
        
        // Delete the application
        const result = await deleteApplication(appName, options.force);
        
        if (result.success) {
          logger.success(`
Application ${appName} has been completely removed from the network.
`);
        } else {
          logger.error(`Failed to delete application: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Failed to delete application: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}