import { Command } from 'commander';
import { stopApplication } from '../services/network.js';
import { logger } from '../utils/logger.js';

export function stopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop a running application')
    .argument('<app-name>', 'Application name')
    .option('-f, --force', 'Force stop without confirmation')
    .action(async (appName, options) => {
      try {
        if (!options.force) {
          // If not forcing, we'd typically prompt for confirmation here
          logger.info(`Stopping application ${appName}...`);
        } else {
          logger.info(`Force stopping application ${appName}...`);
        }
        
        // Stop the application
        const result = await stopApplication(appName, options.force);
        
        if (result.success) {
          logger.success(`
Application ${appName} has been stopped.
To restart it, use:
  debros start ${appName}
`);
        } else {
          logger.error(`Failed to stop application: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Failed to stop application: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}