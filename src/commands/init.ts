import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { installK3s, installNginxIngress, isK3sInstalled } from '../services/k3s.js';
import { config, updateConfig } from '../utils/config.js';
import { logger, startSpinner, stopSpinner } from '../utils/logger.js';

export function initCommand(program: Command) {
  program
    .command('init')
    .description('Initialize DeBros CLI and set up the environment')
    .option('--non-interactive', 'Run in non-interactive mode with default values')
    .action(async (options) => {
      try {
        logger.info('Initializing DeBros CLI...');
        
        let answers = {
          defaultDomain: config.defaultDomain,
          dockerRegistry: config.dockerRegistry,
          defaultDeploymentStrategy: config.defaultDeploymentStrategy,
          solanaEndpoint: config.solanaEndpoint,
          installK3s: true
        };
        
        // If interactive mode, ask questions
        if (!options.nonInteractive) {
          answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'defaultDomain',
              message: 'Default domain suffix for applications:',
              default: config.defaultDomain
            },
            {
              type: 'input',
              name: 'dockerRegistry',
              message: 'Docker registry prefix for images:',
              default: config.dockerRegistry
            },
            {
              type: 'list',
              name: 'defaultDeploymentStrategy',
              message: 'Default deployment strategy:',
              choices: ['k3s', 'docker'],
              default: config.defaultDeploymentStrategy
            },
            {
              type: 'input',
              name: 'solanaEndpoint',
              message: 'Solana RPC endpoint:',
              default: config.solanaEndpoint
            },
            {
              type: 'confirm',
              name: 'installK3s',
              message: 'Install K3s now?',
              default: true,
              when: () => !isK3sInstalled()
            }
          ]);
        }
        
        // Update configuration
        updateConfig('defaultDomain', answers.defaultDomain);
        updateConfig('dockerRegistry', answers.dockerRegistry);
        updateConfig('defaultDeploymentStrategy', answers.defaultDeploymentStrategy);
        updateConfig('solanaEndpoint', answers.solanaEndpoint);
        
        logger.success('Configuration updated successfully');
        
        // Install K3s if requested
        if (answers.installK3s && !isK3sInstalled()) {
          await installK3s();
          await installNginxIngress();
        }
        
        // Create example Dockerfile if it doesn't exist
        const exampleDir = path.join(process.cwd(), 'example-app');
        if (!fs.existsSync(exampleDir)) {
          const spinner = startSpinner('Creating example application...');
          
          try {
            fs.mkdirSync(exampleDir, { recursive: true });
            
            // Create example Dockerfile
            const dockerfilePath = path.join(exampleDir, 'Dockerfile');
            const dockerfileContent = `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN echo '#!/bin/sh\\necho "DeBros Example App running on port 3000"\\nwhile true; do echo \\'{"status":"ok", "timestamp":"\\'$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\'"}\\'  | nc -l -p 3000; done' > server.sh
RUN chmod +x server.sh
EXPOSE 3000
CMD ["./server.sh"]
`;
            fs.writeFileSync(dockerfilePath, dockerfileContent);
            
            // Create README
            const readmePath = path.join(exampleDir, 'README.md');
            const readmeContent = `# DeBros Example App

This is a simple example application to demonstrate the DeBros deployment process.

## Deployment

To deploy this application to the DeBros network, run:

\`\`\`bash
debros upload example-app
\`\`\`

## Local Testing

You can test the application locally with:

\`\`\`bash
docker build -t debros/example-app example-app
docker run -p 3000:3000 debros/example-app
\`\`\`

Then access http://localhost:3000 in your browser.
`;
            fs.writeFileSync(readmePath, readmeContent);
            
            stopSpinner('Example application created in ./example-app', true);
          } catch (error) {
            stopSpinner(`Failed to create example application: ${error instanceof Error ? error.message : String(error)}`, false);
          }
        }
        
        logger.success(`
DeBros CLI initialized successfully!

Quick Start:
1. Upload an application:    debros upload <folder>
2. List your deployments:    debros list
3. Configure a domain:       debros domain <name>

For more information, use:  debros --help
`);
      } catch (error) {
        logger.error(`Failed to initialize DeBros CLI: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}