import { Command } from 'commander';
import { ensureIPNSKey, publishToIPNS } from '../services/ipfs.js';
import { logger } from '../utils/logger.js';

export function configureIPNSCommand(program: Command) {
  program
    .command('configure-ipns')
    .description('Configure IPNS for an application')
    .argument('<name>', 'Application or service name')
    .argument('<cid>', 'IPFS CID to publish')
    .action(async (name, cid) => {
      try {
        logger.info(`Configuring IPNS for ${name} with CID ${cid}`);
        
        // Ensure IPNS key exists
        const keyId = await ensureIPNSKey(name);
        
        // Publish to IPNS
        const ipnsAddress = await publishToIPNS(cid, name);
        
        logger.success(`
IPNS configuration successful!

Application: ${name}
IPFS CID: ${cid}
IPNS key: ${keyId}
IPNS address: ${ipnsAddress}

This IPNS address can now be used to access your application.
You can link a .sol domain to this IPNS address using:

  debros domain link ${name}.debros.sol ${ipnsAddress}
`);
      } catch (error) {
        logger.error(`Failed to configure IPNS: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}