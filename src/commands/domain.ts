import { Command } from 'commander';
import { checkDomainAvailability, guideDomainRegistration, configureDomainIPNS } from '../services/solana.js';
import { ensureIPNSKey } from '../services/ipfs.js';
import { logger } from '../utils/logger.js';

export function domainCommand(program: Command) {
  const domain = program
    .command('domain')
    .description('Manage .sol domains for your applications');
    
  domain
    .command('check')
    .description('Check if a .sol domain is available')
    .argument('<domain>', 'Domain name to check (e.g., myapp.debros.sol)')
    .action(async (domainName) => {
      try {
        // Ensure domain has .sol suffix
        if (!domainName.endsWith('.sol')) {
          domainName = `${domainName}.sol`;
        }
        
        logger.info(`Checking availability of ${domainName}...`);
        const isAvailable = await checkDomainAvailability(domainName);
        
        if (isAvailable) {
          logger.success(`
Domain ${domainName} is available for registration!

${guideDomainRegistration(domainName)}
`);
        } else {
          logger.warn(`
Domain ${domainName} is already registered.

Try another domain name or contact the current owner.
`);
        }
      } catch (error) {
        logger.error(`Failed to check domain: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
    
  domain
    .command('register')
    .description('Guide you through registering a .sol domain')
    .argument('<domain>', 'Domain name to register (e.g., myapp.debros.sol)')
    .action(async (domainName) => {
      try {
        // Ensure domain has .sol suffix
        if (!domainName.endsWith('.sol')) {
          domainName = `${domainName}.sol`;
        }
        
        logger.info(`Preparing to register ${domainName}...`);
        
        // Check availability first
        const isAvailable = await checkDomainAvailability(domainName);
        
        if (isAvailable) {
          const guide = guideDomainRegistration(domainName);
          logger.success(`
${guide}

After registration, link the domain to your IPNS address using:
  debros domain link ${domainName} <ipns-address>
`);
        } else {
          logger.warn(`
Domain ${domainName} is already registered.

Try another domain name or contact the current owner.
`);
        }
      } catch (error) {
        logger.error(`Failed to register domain: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
    
  domain
    .command('link')
    .description('Link a .sol domain to an IPNS address')
    .argument('<domain>', 'Domain name (e.g., myapp.debros.sol)')
    .argument('<ipns-address>', 'IPNS address to link to (or application name)')
    .action(async (domainName, ipnsAddr) => {
      try {
        // Ensure domain has .sol suffix
        if (!domainName.endsWith('.sol')) {
          domainName = `${domainName}.sol`;
        }
        
        // Check if ipnsAddr is an IPNS address or an application name
        if (!ipnsAddr.startsWith('/ipns/')) {
          logger.info(`${ipnsAddr} appears to be an application name, looking up IPNS key...`);
          // Treat as an application name and get the IPNS key
          const keyName = ipnsAddr;
          const keyId = await ensureIPNSKey(keyName);
          
          // If we found a key, create an IPNS address
          ipnsAddr = `/ipns/${keyId}`;
          logger.info(`Using IPNS address: ${ipnsAddr}`);
        }
        
        logger.info(`Linking domain ${domainName} to ${ipnsAddr}...`);
        
        // Create a DNS TXT record for the domain
        const dnsLink = `dnslink=${ipnsAddr}`;
        
        logger.success(`
To link ${domainName} to ${ipnsAddr}, set the following DNS records:

1. TXT record:
   Name:  _dnslink.${domainName}
   Value: ${dnsLink}

2. (Optional) A record:
   Name:  ${domainName}
   Value: <Your public IPFS gateway IP>

For the Solana Name Service, update your domain's resolver to point to:
${ipnsAddr}

Once DNS propagates (up to 24 hours), your application will be accessible at:
http://${domainName}/
`);
      } catch (error) {
        logger.error(`Failed to link domain: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
    
  domain
    .command('setup')
    .description('Set up a domain with application and IPNS in one step')
    .argument('<domain>', 'Domain name (e.g., myapp.debros.sol)')
    .argument('<cid>', 'IPFS CID of the application content')
    .action(async (domainName, cid) => {
      try {
        // Ensure domain has .sol suffix
        if (!domainName.endsWith('.sol')) {
          domainName = `${domainName}.sol`;
        }
        
        logger.info(`Setting up ${domainName} for CID ${cid}...`);
        
        // Extract application name from domain
        const appName = domainName.split('.')[0];
        
        // Configure domain with IPNS
        const result = await configureDomainIPNS(domainName, appName, cid);
        
        logger.success(`
Domain ${domainName} set up successfully!

IPFS CID: ${cid}
IPNS address: ${result.ipnsPath}

To complete the setup, set the following DNS record:

TXT record:
Name:  _dnslink.${domainName}
Value: ${result.dnsLinkValue}

Once DNS propagates (up to 24 hours), your application will be accessible at:
http://${domainName}/
`);
      } catch (error) {
        logger.error(`Failed to set up domain: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
    
  return domain;
}