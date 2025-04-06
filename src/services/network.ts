import {
  getLibp2p,
  getConnectedPeers,
  initIpfs,
  stopIpfs,
  initOrbitDB,
  openDB,
  getOrbitDB,
} from "@debros/network";
import { logger, startSpinner, stopSpinner } from "../utils/logger.js";
import { config } from "../utils/config.js";
import { NodeInfo } from "./ipfs.js";

// This service handles communication with remote DeBros network nodes
// It does not manage local node deployment, but rather allows the CLI
// to discover, communicate with, and deploy to remote nodes in the network

interface AppData {
  appName: string;
  cid: string;
  version: string;
  timestamp: string;
  deployed: boolean;
  domain?: string;
  status: 'running' | 'stopped' | 'unknown';
}

/**
 * Get the application_data OrbitDB instance
 */
async function getApplicationDataDB() {
  try {
    // Initialize IPFS if it's not already running
    await initIpfs();
    
    // Initialize OrbitDB
    await initOrbitDB();
    
    // Open the application_data database (create if it doesn't exist)
    // Feed type is suitable for append-only logs like application deployment records
    const db = await openDB('application_data', 'feed');
    
    return db;
  } catch (error) {
    logger.error(`Failed to initialize application_data database: ${
      error instanceof Error ? error.message : String(error)
    }`);
    throw error;
  }
}

/**
 * Check if an application name is available in the network
 */
export async function checkAppNameAvailability(appName: string): Promise<boolean> {
  const spinner = startSpinner(`Checking if application name "${appName}" is available...`);
  
  try {
    // Get the application_data database
    const db = await getApplicationDataDB();
    
    // Query the database for entries with this app name
    const entries = await db.iterator({ limit: -1 }).collect();
    const existingApps = entries
      .map((entry: any) => entry.value.appName)
      .filter((name: string) => name === appName);
    
    const isAvailable = existingApps.length === 0;
    
    stopSpinner(`Application name "${appName}" is ${isAvailable ? 'available' : 'already taken'}`, true);
    
    // Clean up IPFS
    await stopIpfs();
    
    return isAvailable;
  } catch (error) {
    stopSpinner(
      `Failed to check application name availability: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Store application data in OrbitDB
 */
export async function storeAppData(appData: AppData): Promise<boolean> {
  const spinner = startSpinner(`Storing application data for ${appData.appName}...`);
  
  try {
    // Get the application_data database
    const db = await getApplicationDataDB();
    
    // Add the application data to the database
    const hash = await db.add(appData);
    logger.debug(`Stored app data with hash: ${hash}`);
    
    // Create a message to broadcast the app data update to peers
    const message = {
      type: "app-data-update",
      appData,
      timestamp: Date.now(),
    };
    
    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (libp2p) {
      // Publish to the debros-app-data topic
      await libp2p.services.pubsub.publish(
        "debros-app-data",
        new TextEncoder().encode(JSON.stringify(message))
      );
    }
    
    stopSpinner(`Application data for ${appData.appName} stored successfully`, true);
    
    // Clean up IPFS
    await stopIpfs();
    
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to store application data: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Get all currently connected peers
 */
export async function getPeers(): Promise<any> {
  const spinner = startSpinner("Getting connected peers...");

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the connected peers
    const peers = getConnectedPeers();
    stopSpinner(`Found ${peers.length} connected peers`, true);

    return peers;
  } catch (error) {
    stopSpinner(
      `Failed to get peers: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Convert connected peers to NodeInfo format
 */
export async function getPeersAsNodeInfo(): Promise<NodeInfo[]> {
  const peers = await getPeers();
  const nodeInfos: NodeInfo[] = [];

  peers.forEach((data: any, peerId: any) => {
    const { load, publicAddress } = data;

    try {
      // Extract address and port from publicAddress
      const url = new URL(publicAddress);
      const address = url.hostname;
      const port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);

      nodeInfos.push({
        id: peerId,
        address,
        port,
        load,
        type: "k3s", // Default to k3s, could be dynamically determined in the future
      });
    } catch (error) {
      logger.warn(
        `Invalid public address for peer ${peerId}: ${publicAddress}`
      );
    }
  });

  return nodeInfos;
}

/**
 * Announce a deployment to the network
 */
export async function announceDeployment(
  cid: string,
  appName: string,
  version: string = "latest",
  domain: string = ""
) {
  const spinner = startSpinner(
    `Announcing deployment of ${appName}:${version} to the network...`
  );

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Use default domain if not provided
    let appDomain = domain || `${appName}.${config.defaultDomain}`;

    // Ensure the domain ends with .debros.sol
    if (!appDomain.endsWith(`.${config.defaultDomain}`)) {
      // Remove any domain suffix if present
      const cleanSubdomain = appDomain.split(".")[0];
      appDomain = `${cleanSubdomain}.${config.defaultDomain}`;
    }

    // Create the deployment announcement message
    const message = {
      type: "deployment",
      cid,
      appName,
      version,
      domain: appDomain,
      timestamp: Date.now(),
    };

    // Publish to the debros-deploy topic
    await libp2p.services.pubsub.publish(
      "debros-deploy",
      new TextEncoder().encode(JSON.stringify(message))
    );
    
    // Update app data in OrbitDB
    await storeAppData({
      appName,
      cid,
      version,
      timestamp: new Date().toISOString(),
      deployed: true,
      domain: appDomain,
      status: 'running'
    });

    stopSpinner(`Deployment announced to the network`, true);

    // Clean up IPFS
    await stopIpfs();

    return true;
  } catch (error) {
    stopSpinner(
      `Failed to announce deployment: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Listen for deployment announcements
 */
export async function listenForDeployments(
  callback: (message: {
    cid: string;
    appName: string;
    version: string;
    domain: string;
  }) => void
) {
  const spinner = startSpinner("Listening for deployment announcements...");

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Subscribe to the debros-deploy topic
    await libp2p.services.pubsub.subscribe("debros-deploy");

    // Set up the message handler
    libp2p.services.pubsub.addEventListener("message", (event: any) => {
      try {
        if (event.detail.topic === "debros-deploy") {
          const msgData = new TextDecoder().decode(event.detail.data);
          const message = JSON.parse(msgData);

          if (message.type === "deployment") {
            callback({
              cid: message.cid,
              appName: message.appName,
              version: message.version,
              domain:
                message.domain || `${message.appName}.${config.defaultDomain}`,
            });
          }
        }
      } catch (error) {
        logger.error(
          `Failed to process deployment message: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    });

    stopSpinner("Listening for deployment announcements", true);
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to listen for deployments: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Get all applications and their data
 */
export async function getAllApps(): Promise<AppData[]> {
  const spinner = startSpinner("Fetching all applications...");

  try {
    // Get the application_data database
    const db = await getApplicationDataDB();
    
    // Query all entries from the database
    const entries = await db.iterator({ limit: -1 }).collect();
    
    // Process the entries to get the latest status for each app
    const appMap = new Map<string, AppData>();
    
    // Process entries in reverse (newest first) to get the latest status
    entries.reverse().forEach((entry: any) => {
      const appData = entry.value as AppData;
      
      // If we haven't seen this app before, or if this is a newer entry, update our record
      if (!appMap.has(appData.appName) || 
          new Date(appMap.get(appData.appName)!.timestamp) < new Date(appData.timestamp)) {
        appMap.set(appData.appName, appData);
      }
    });
    
    // Convert the map values to an array
    const apps = Array.from(appMap.values());

    stopSpinner(`Found ${apps.length} applications`, true);

    // Clean up IPFS
    await stopIpfs();

    return apps;
  } catch (error) {
    stopSpinner(
      `Failed to fetch applications: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Get versions of an application
 */
export async function getAppVersions(appName: string): Promise<
  Array<{
    tag: string;
    cid: string;
    timestamp: string;
    deployed: boolean;
  }>
> {
  const spinner = startSpinner(`Fetching versions for ${appName}...`);

  try {
    // Get the application_data database
    const db = await getApplicationDataDB();
    
    // Query all entries from the database for this app
    const entries = await db.iterator({ limit: -1 }).collect();
    
    // Filter entries for this app
    const appEntries = entries
      .filter((entry: any) => entry.value.appName === appName)
      .map((entry: any) => {
        const data = entry.value as AppData;
        return {
          tag: data.version,
          cid: data.cid,
          timestamp: data.timestamp,
          deployed: data.deployed,
        };
      });
    
    // Sort by timestamp, newest first
    const versions = appEntries.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Mark only the latest version as deployed if any are deployed
    const latestDeployedIndex = versions.findIndex((v: any) => v.deployed);
    if (latestDeployedIndex !== -1) {
      // Set all versions to not deployed
      versions.forEach((v: any) => v.deployed = false);
      // Set only the latest to deployed
      versions[latestDeployedIndex].deployed = true;
    }

    stopSpinner(`Found ${versions.length} versions for ${appName}`, true);

    // Clean up IPFS
    await stopIpfs();

    return versions;
  } catch (error) {
    stopSpinner(
      `Failed to fetch versions: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Rollback an application to a specific version
 */
export async function rollbackToVersion(
  appName: string,
  versionTag?: string,
  domain?: string,
  force: boolean = false
): Promise<{
  success: boolean;
  message?: string;
  version?: string;
  cid?: string;
}> {
  const spinner = startSpinner(
    `Rolling back ${appName} to ${versionTag || "previous version"}...`
  );

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Get versions to find the right one
    const versions = await getAppVersions(appName);

    if (versions.length === 0) {
      stopSpinner(`No versions found for ${appName}`, false);
      return { success: false, message: `No versions found for ${appName}` };
    }

    // Find the requested version or previous version
    let targetVersion;

    if (versionTag) {
      // Find specific version
      targetVersion = versions.find((v) => v.tag === versionTag);
      if (!targetVersion) {
        stopSpinner(`Version ${versionTag} not found for ${appName}`, false);
        return { success: false, message: `Version ${versionTag} not found` };
      }
    } else {
      // Find previous version (not current)
      const currentVersion = versions.find((v) => v.deployed);
      const otherVersions = versions
        .filter((v) => !v.deployed)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

      if (otherVersions.length === 0) {
        stopSpinner(`No previous versions found for ${appName}`, false);
        return {
          success: false,
          message: "No previous versions found to rollback to",
        };
      }

      targetVersion = otherVersions[0];
    }

    // Announce the rollback deployment with the CID of the target version
    const appDomain = domain || `${appName}.${config.defaultDomain}`;

    // Create the deployment announcement message
    const message = {
      type: "deployment",
      cid: targetVersion.cid,
      appName,
      version: targetVersion.tag,
      domain: appDomain,
      isRollback: true,
      timestamp: Date.now(),
    };

    // Publish to the debros-deploy topic
    await libp2p.services.pubsub.publish(
      "debros-deploy",
      new TextEncoder().encode(JSON.stringify(message))
    );
    
    // Update app data in OrbitDB
    await storeAppData({
      appName,
      cid: targetVersion.cid,
      version: targetVersion.tag,
      timestamp: new Date().toISOString(),
      deployed: true,
      domain: appDomain,
      status: 'running'
    });

    stopSpinner(`Rolled back ${appName} to version ${targetVersion.tag}`, true);

    // Clean up IPFS
    await stopIpfs();

    return {
      success: true,
      version: targetVersion.tag,
      cid: targetVersion.cid,
    };
  } catch (error) {
    stopSpinner(
      `Failed to rollback: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop an application
 */
export async function stopApplication(
  appName: string,
  force: boolean = false
): Promise<{
  success: boolean;
  message?: string;
}> {
  const spinner = startSpinner(`Stopping application ${appName}...`);

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Create the stop message
    const message = {
      type: "application-action",
      action: "stop",
      appName,
      force,
      timestamp: Date.now(),
    };

    // Publish to the debros-app-actions topic
    await libp2p.services.pubsub.publish(
      "debros-app-actions",
      new TextEncoder().encode(JSON.stringify(message))
    );
    
    // Update app data in OrbitDB
    const apps = await getAllApps();
    const appData = apps.find(app => app.appName === appName);
    
    if (appData) {
      await storeAppData({
        ...appData,
        status: 'stopped',
        timestamp: new Date().toISOString()
      });
    }

    stopSpinner(
      `Stop command for ${appName} has been sent to the network`,
      true
    );

    // Clean up IPFS
    await stopIpfs();

    return { success: true };
  } catch (error) {
    stopSpinner(
      `Failed to stop application: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Start an application
 */
export async function startApplication(
  appName: string,
  versionTag: string = "latest"
): Promise<{
  success: boolean;
  message?: string;
}> {
  const spinner = startSpinner(
    `Starting application ${appName} with version ${versionTag}...`
  );

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Get versions to find the right CID
    const versions = await getAppVersions(appName);

    if (versions.length === 0) {
      stopSpinner(`No versions found for ${appName}`, false);
      return { success: false, message: `No versions found for ${appName}` };
    }

    // Find the requested version
    const targetVersion = versions.find((v) => v.tag === versionTag);
    if (!targetVersion) {
      stopSpinner(`Version ${versionTag} not found for ${appName}`, false);
      return { success: false, message: `Version ${versionTag} not found` };
    }

    // Create the start message
    const message = {
      type: "application-action",
      action: "start",
      appName,
      version: versionTag,
      cid: targetVersion.cid,
      timestamp: Date.now(),
    };

    // Publish to the debros-app-actions topic
    await libp2p.services.pubsub.publish(
      "debros-app-actions",
      new TextEncoder().encode(JSON.stringify(message))
    );
    
    // Update app data in OrbitDB
    const apps = await getAllApps();
    const appData = apps.find(app => app.appName === appName);
    const appDomain = appData?.domain || `${appName}.${config.defaultDomain}`;
    
    await storeAppData({
      appName,
      cid: targetVersion.cid,
      version: versionTag,
      timestamp: new Date().toISOString(),
      deployed: true,
      domain: appDomain,
      status: 'running'
    });

    stopSpinner(
      `Start command for ${appName} with version ${versionTag} has been sent to the network`,
      true
    );

    // Clean up IPFS
    await stopIpfs();

    return { success: true };
  } catch (error) {
    stopSpinner(
      `Failed to start application: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete an application
 */
export async function deleteApplication(
  appName: string,
  force: boolean = false
): Promise<{
  success: boolean;
  message?: string;
}> {
  const spinner = startSpinner(`Deleting application ${appName}...`);

  try {
    // Initialize IPFS if it's not already running
    await initIpfs();

    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      throw new Error("LibP2P is not initialized");
    }

    // Create the delete message
    const message = {
      type: "application-action",
      action: "delete",
      appName,
      force,
      timestamp: Date.now(),
    };

    // Publish to the debros-app-actions topic
    await libp2p.services.pubsub.publish(
      "debros-app-actions",
      new TextEncoder().encode(JSON.stringify(message))
    );
    
    // Update app data in OrbitDB - in a real implementation, we would remove the app data
    const apps = await getAllApps();
    const appData = apps.find(app => app.appName === appName);
    
    if (appData) {
      // In a real implementation, this would delete the app data from OrbitDB
      logger.debug(`Deleting app data for ${appName}`);
    }

    stopSpinner(
      `Delete command for ${appName} has been sent to the network`,
      true
    );

    // Clean up IPFS
    await stopIpfs();

    return { success: true };
  } catch (error) {
    stopSpinner(
      `Failed to delete application: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop listening for deployment announcements
 */
export async function stopListeningForDeployments() {
  const spinner = startSpinner("Stopping deployment listener...");

  try {
    // Get the libp2p instance
    const libp2p = getLibp2p();
    if (!libp2p) {
      spinner.text = "LibP2P is not initialized, nothing to stop";
      stopSpinner("Stopped deployment listener", true);
      return true;
    }

    // Unsubscribe from the debros-deploy topic
    await libp2p.services.pubsub.unsubscribe("debros-deploy");

    // Stop IPFS
    await stopIpfs();

    stopSpinner("Stopped deployment listener", true);
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to stop deployment listener: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}