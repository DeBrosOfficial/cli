import { Command } from 'commander';
import { listDebrosImages } from '../services/docker.js';
import { listK3sDeployments } from '../services/k3s.js';
import { getPeersAsNodeInfo } from '../services/network.js';
import { logger } from '../utils/logger.js';

export function listCommand(program: Command) {
  program
    .command('list')
    .description('List DeBros deployments and network information')
    .option('-a, --apps', 'List deployed applications')
    .option('-n, --nodes', 'List network nodes')
    .option('-i, --images', 'List local Docker images')
    .option('-d, --detailed', 'Show detailed information')
    .action(async (options) => {
      try {
        // Default to listing all if no specific option is provided
        const listAll = !options.apps && !options.nodes && !options.images;
        
        // List applications
        if (listAll || options.apps) {
          logger.info('=== DeBros Applications ===');
          
          try {
            const deployments = await listK3sDeployments();
            
            if (deployments && deployments.length > 0) {
              deployments.forEach((dep: any) => {
                const name = dep.metadata.name;
                const status = dep.status.availableReplicas > 0 ? 'Running' : 'Pending';
                const replicas = `${dep.status.availableReplicas || 0}/${dep.spec.replicas}`;
                
                logger.raw(`${name} (${status}) - Replicas: ${replicas}`);
                
                if (options.detailed) {
                  const containers = dep.spec.template.spec.containers;
                  containers.forEach((container: any) => {
                    logger.raw(`  - Image: ${container.image}`);
                    logger.raw(`  - Ports: ${container.ports?.map((p: any) => p.containerPort).join(', ') || 'none'}`);
                  });
                }
              });
            } else {
              logger.warn('No applications deployed on K3s');
            }
          } catch (error) {
            logger.warn('Failed to list K3s deployments, they may not be installed');
          }
          
          logger.raw('');
        }
        
        // List nodes
        if (listAll || options.nodes) {
          logger.info('=== DeBros Network Nodes ===');
          
          try {
            const nodes = await getPeersAsNodeInfo();
            
            if (nodes.length > 0) {
              nodes.forEach(node => {
                logger.raw(`${node.id.slice(0, 12)}... (${node.type}) - ${node.address}:${node.port} - Load: ${node.load}`);
              });
            } else {
              logger.warn('No network nodes found');
            }
          } catch (error) {
            logger.error(`Failed to list network nodes: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          logger.raw('');
        }
        
        // List images
        if (listAll || options.images) {
          logger.info('=== DeBros Docker Images ===');
          
          try {
            const images = await listDebrosImages();
            
            if (images.length > 0) {
              images.forEach(image => {
                const tags = image.RepoTags ? image.RepoTags.join(', ') : 'none';
                const size = Math.round(image.Size / (1024 * 1024) * 10) / 10; // Convert to MB with 1 decimal
                
                logger.raw(`${tags} - ${size} MB`);
                
                if (options.detailed) {
                  logger.raw(`  - ID: ${image.Id}`);
                  logger.raw(`  - Created: ${new Date(image.Created * 1000).toISOString()}`);
                }
              });
            } else {
              logger.warn('No DeBros Docker images found');
            }
          } catch (error) {
            logger.error(`Failed to list Docker images: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to list DeBros deployments: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}