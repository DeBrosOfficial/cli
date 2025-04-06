import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { logger } from './logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Calculate config file path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(os.homedir(), '.debros');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configuration
export interface DebrosCliConfig {
  ipfsDataPath: string;
  ipnsKeysPath: string;
  dockerRegistry: string;
  bootstrapNodes: string[];
  defaultDomain: string;
  solanaEndpoint: string;
  defaultDeploymentStrategy: 'k3s' | 'docker';
}

const defaultConfig: DebrosCliConfig = {
  ipfsDataPath: path.join(os.homedir(), '.debros', 'ipfs'),
  ipnsKeysPath: path.join(os.homedir(), '.debros', 'ipns'),
  dockerRegistry: 'debros',
  bootstrapNodes: [
    '/ip4/188.166.113.190/tcp/7778/p2p/12D3KooWNWgs4WAUmE4CsxrL6uuyv1yuTzcRReMe5r7Psemsg2Z9',
    '/ip4/82.208.21.140/tcp/7778/p2p/12D3KooWPUdpNX5N6dsuFAvgwfBMXUoFK2QS5sh8NpjxbfGpkSCi'
  ],
  defaultDomain: 'debros.sol',
  solanaEndpoint: 'https://api.mainnet-beta.solana.com',
  defaultDeploymentStrategy: 'docker'
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    logger.debug(`Created config directory at ${CONFIG_DIR}`);
  } catch (error) {
    logger.error(`Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Create IPFS and IPNS directories if they don't exist
if (!fs.existsSync(defaultConfig.ipfsDataPath)) {
  try {
    fs.mkdirSync(defaultConfig.ipfsDataPath, { recursive: true });
    logger.debug(`Created IPFS data directory at ${defaultConfig.ipfsDataPath}`);
  } catch (error) {
    logger.error(`Failed to create IPFS data directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!fs.existsSync(defaultConfig.ipnsKeysPath)) {
  try {
    fs.mkdirSync(defaultConfig.ipnsKeysPath, { recursive: true });
    logger.debug(`Created IPNS keys directory at ${defaultConfig.ipnsKeysPath}`);
  } catch (error) {
    logger.error(`Failed to create IPNS keys directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Load config or create default
export function loadConfig(): DebrosCliConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    const loadedConfig = JSON.parse(configData) as DebrosCliConfig;
    
    // Merge with defaults in case there are new fields
    return { ...defaultConfig, ...loadedConfig };
  } catch (error) {
    logger.error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    return defaultConfig;
  }
}

// Save config
export function saveConfig(config: DebrosCliConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    logger.debug('Configuration saved successfully');
  } catch (error) {
    logger.error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Update a specific config setting
export function updateConfig(key: keyof DebrosCliConfig, value: any): DebrosCliConfig {
  const currentConfig = loadConfig();
  const updatedConfig = { ...currentConfig, [key]: value };
  saveConfig(updatedConfig);
  return updatedConfig;
}

export const config = loadConfig();
export default config;