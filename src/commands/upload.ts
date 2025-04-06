import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import { buildDockerImage, saveDockerImage } from '../services/docker.js';
import { uploadToIPFS, publishNodeList } from '../services/ipfs.js';
import { announceDeployment, checkAppNameAvailability } from '../services/network.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export function uploadCommand(program: Command) {
  program
    .command('upload')
    .description('Build, upload and announce a project to the DeBros network')
    .argument('<folder>', 'Project folder to upload')
    .option('-t, --tag <tag>', 'Docker image tag', 'latest')
    .option('-n, --name <name>', 'Application name (defaults to folder name)')
    .option('-d, --domain <subdomain>', 'Custom subdomain - will be appended with .debros.sol')
    .action(async (folder, options) => {
      try {
        // Resolve folder path
        const folderPath = path.resolve(process.cwd(), folder);
        
        // Make sure the folder exists
        if (!fs.existsSync(folderPath)) {
          logger.error(`Folder not found: ${folderPath}`);
          process.exit(1);
        }
        
        // Get the application name from options or folder name
        const appName = options.name || path.basename(folderPath);
        const tag = options.tag || 'latest';
        
        // Check if the app name is available in the network
        const isAppNameAvailable = await checkAppNameAvailability(appName);
        if (!isAppNameAvailable) {
          logger.error(`Application name "${appName}" is already taken in the DeBros network.`);
          logger.info('Please choose a different name using the --name option.');
          process.exit(1);
        }
        
        // Get the subdomain from options or use the app name
        const subdomain = options.domain || appName;
        
        // Ensure we only use the subdomain part and force .debros.sol domain
        const cleanSubdomain = subdomain.replace(/\.debros\.sol$/i, ''); // Remove .debros.sol if user included it
        const domain = `${cleanSubdomain}.${config.defaultDomain}`;
        
        // Step 1: Build Docker image
        const { imageName } = await buildDockerImage(folderPath, appName, tag);
        
        // Step 2: Save Docker image to tar file
        const tarPath = path.join(process.cwd(), `${appName}.tar`);
        await saveDockerImage(imageName, tarPath);
        
        // Step 3: Upload tar file to IPFS
        const cid = await uploadToIPFS(tarPath);
        
        // Step 4: Create initial node list (empty for now, nodes will pick it up)
        await publishNodeList([], appName);
        
        // Step 5: Announce deployment to the network
        await announceDeployment(cid, appName, tag, domain);
        
        // Clean up temporary tar file
        fs.unlinkSync(tarPath);
        
        logger.success(`
Application ${appName}:${tag} uploaded successfully!
IPFS CID: ${cid}
        
The application will now be deployed to available nodes in the DeBros network.
It will be accessible at: http://${domain}

IMPORTANT: Your application should listen on port 8787 internally.
Environment variables PORT=8787 and DEBROS_APP_NAME=${appName} will be set automatically.

Use 'debros list' to check the status of your deployment.
`);
      } catch (error) {
        logger.error(`Failed to upload project: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}