import { Command } from 'commander';
import { loadDockerImage, runContainer } from '../services/docker.js';
import { installK3s, installNginxIngress, deployToK3s } from '../services/k3s.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export function deployCommand(program: Command) {
  program
    .command('deploy')
    .description('Deploy a Docker image to a local K3s node')
    .argument('<image-path>', 'Path to the Docker image tar file')
    .option('-n, --name <name>', 'Application name')
    // Port is fixed at 8787 for standardization
    // Replicas fixed at 2 for redundancy
    // Strategy and namespace handled automatically
    .action(async (imagePath, options) => {
      try {
        // Load the Docker image
        const { loadedImage } = await loadDockerImage(imagePath);
        
        if (!loadedImage) {
          logger.error('Failed to load Docker image');
          process.exit(1);
        }
        
        const appName = options.name || loadedImage.split('/').pop()?.split(':')[0] || 'app';
        // Fixed standardized port and replica count
        const port = 8787;
        const replicas = 2;  // Always deploy with redundancy
        const namespace = 'debros-apps';  // Standard namespace for all applications
        
        // Always use K3s for standardized deployments
        // Install K3s if not already installed
        await installK3s();
        
        // Install Nginx Ingress Controller
        await installNginxIngress();
        
        // Deploy the application to K3s
        const result = await deployToK3s(
          appName,
          loadedImage,
          namespace,
          port,
          replicas
        );
        
        logger.success(`
Application ${appName} deployed successfully!
Access URL: http://${appName}.${config.defaultDomain}
          
Your application is now running on the DeBros network.
Internal port: 8787
External domain: ${appName}.${config.defaultDomain}
`);
      } catch (error) {
        logger.error(`Failed to deploy application: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}