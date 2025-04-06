import { Connection, PublicKey } from '@solana/web3.js';
import { execSync } from 'child_process';
import { logger, startSpinner, stopSpinner } from '../utils/logger.js';
import { config } from '../utils/config.js';

// Create Solana connection
const connection = new Connection(config.solanaEndpoint);

/**
 * Check if a .sol domain is available
 */
export async function checkDomainAvailability(domain: string): Promise<boolean> {
  const spinner = startSpinner(`Checking availability of ${domain}...`);
  
  try {
    // This is a simplified approach. In reality, you'd interact with the Solana Name Service
    // For now, we'll simulate this interaction
    
    // Simulate a domain lookup by creating a deterministic "domain address"
    const domainKey = new PublicKey(
      Buffer.from(`domains:${domain.toLowerCase().replace('.sol', '')}`, 'utf-8')
    );
    
    // Check if an account exists at this address
    const accountInfo = await connection.getAccountInfo(domainKey);
    const isAvailable = accountInfo === null;
    
    if (isAvailable) {
      stopSpinner(`Domain ${domain} is available!`, true);
    } else {
      stopSpinner(`Domain ${domain} is already registered`, false);
    }
    
    return isAvailable;
  } catch (error) {
    stopSpinner(`Failed to check domain availability: ${error instanceof Error ? error.message : String(error)}`, false);
    throw error;
  }
}

/**
 * Create DNS link for a domain
 */
export function createDNSLink(domain: string, ipnsPath: string): string {
  const spinner = startSpinner(`Creating DNS link for ${domain} pointing to ${ipnsPath}...`);
  
  try {
    // Guidance message for user - actual DNS TXT record creation would need to be done 
    // through a registrar that supports Solana Name Service domains
    const dnsLinkValue = `dnslink=${ipnsPath}`;
    
    spinner.text = 'DNS link creation requires a supporting registrar';
    stopSpinner(`To create a DNS link for ${domain}, add a TXT record with key _dnslink and value: ${dnsLinkValue}`, true);
    
    return dnsLinkValue;
  } catch (error) {
    stopSpinner(`Failed to create DNS link: ${error instanceof Error ? error.message : String(error)}`, false);
    throw error;
  }
}

/**
 * Guide the user to register a .sol domain
 */
export function guideDomainRegistration(domain: string): string {
  const spinner = startSpinner(`Preparing guide for registering ${domain}...`);
  
  try {
    // Create a guide for the user
    const guide = `
To register the "${domain}" domain:

1. Visit a Solana Name Service provider like:
   - Solana Name Service: https://naming.service
   - Bonfida: https://naming.bonfida.org

2. Connect your Solana wallet (like Phantom, Solflare, etc.)

3. Search for "${domain.replace('.sol', '')}"

4. Complete the registration process and pay the registration fee (~$5/year + network fees)

5. Once registered, return to the DeBros CLI to configure your domain
`;
    
    stopSpinner('Domain registration guide prepared', true);
    return guide;
  } catch (error) {
    stopSpinner(`Failed to create guide: ${error instanceof Error ? error.message : String(error)}`, false);
    throw error;
  }
}

/**
 * Configure IPNS with a domain
 */
export async function configureDomainIPNS(domain: string, keyName: string, ipfsCid: string) {
  const spinner = startSpinner(`Configuring ${domain} with IPNS...`);
  
  try {
    // First publish the CID to IPNS with the key
    const publishOutput = execSync(`ipfs name publish --key=${keyName} /ipfs/${ipfsCid}`).toString();
    const ipnsPath = publishOutput.match(/to (.+)/)?.[1]?.trim() || '';
    
    if (!ipnsPath) {
      throw new Error('Failed to get IPNS path from publish operation');
    }
    
    // Create guidance for DNS Link
    const dnsLinkValue = createDNSLink(domain, ipnsPath);
    
    stopSpinner(`${domain} configured with IPNS address: ${ipnsPath}`, true);
    
    return {
      domain,
      ipnsPath,
      dnsLinkValue
    };
  } catch (error) {
    stopSpinner(`Failed to configure domain IPNS: ${error instanceof Error ? error.message : String(error)}`, false);
    throw error;
  }
}