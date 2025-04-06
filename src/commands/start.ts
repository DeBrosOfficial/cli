import { Command } from 'commander';
import { startApplication } from '../services/network.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export function startCommand(program: Command) {
  program
    .command('start')
    .description('Start a stopped application')
    .argument('<app-name>', 'Application name')
    .option('-v, --version <version>', 'Version tag to start (defaults to latest)')
    .action(async (appName, options) => {
      try {
        const versionTag = options.version || 'latest';
        logger.info(`Starting application ${appName} with version ${versionTag}...`);
        
        // Get domain
        const domain = `${appName}.${config.defaultDomain}`;
        
        // Start the application
        const result = await startApplication(appName, versionTag);
        
        if (result.success) {
          logger.success(`
Application ${appName} has been started with version ${versionTag}.
It will be accessible at: http://${domain}
`);
        } else {
          logger.error(`Failed to start application: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Failed to start application: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}