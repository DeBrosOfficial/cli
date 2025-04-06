import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { logger, startSpinner, stopSpinner } from "../utils/logger.js";
import { config } from "../utils/config.js";
import { initIpfs, getHelia, getLibp2p, stopIpfs } from "@debros/network";

// Interface to represent a Node in the network
export interface NodeInfo {
  id: string;
  address: string;
  port: number;
  load: number;
  type: "k3s" | "docker";
}

// Interface for node list JSON
export interface NodeList {
  nodes: NodeInfo[];
  updatedAt: string;
}

/**
 * Initialize IPFS instance using the @debros/network configuration
 */
export async function initializeIpfs() {
  const spinner = startSpinner("Initializing IPFS with DeBros Network...");

  try {
    // Use the initIpfs function from @debros/network
    await initIpfs();

    const ipfs = getHelia();
    const libp2p = getLibp2p();

    if (!ipfs || !libp2p) {
      throw new Error("Failed to initialize IPFS or libp2p");
    }

    // Get the peer ID
    const peerId = libp2p.peerId.toString();
    stopSpinner(`IPFS initialized with ID: ${peerId}`, true);

    return { ipfs, libp2p };
  } catch (error) {
    stopSpinner(
      `Failed to initialize IPFS: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Upload a file to IPFS
 */
export async function uploadToIPFS(filePath: string) {
  const spinner = startSpinner(`Uploading ${filePath} to IPFS...`);

  try {
    // Initialize IPFS
    const { ipfs } = await initializeIpfs();

    // Read the file
    const fileContent = fs.readFileSync(filePath);

    // Create a block for the file content
    const encoder = new TextEncoder();
    const bytes = encoder.encode(fileContent.toString());

    // Add the content to IPFS
    const { cid } = await ipfs.blockstore.put(bytes);

    // Stop IPFS to clean up
    await stopIpfs();

    stopSpinner(`File uploaded with CID: ${cid.toString()}`, true);
    return cid.toString();
  } catch (error) {
    stopSpinner(
      `Failed to upload file: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Generate IPNS key if it doesn't exist
 */
export async function ensureIPNSKey(name: string) {
  const spinner = startSpinner(`Ensuring IPNS key exists for ${name}...`);

  try {
    // We'll use the ipfs CLI for this since the JS library doesn't expose key management well
    const keyListOutput = execSync("ipfs key list -l").toString();
    const keyExists = keyListOutput.includes(name);

    if (!keyExists) {
      logger.info(`Creating new IPNS key: ${name}`);
      execSync(`ipfs key gen --type=rsa --size=2048 ${name}`);
      spinner.text = `Created new IPNS key: ${name}`;
    } else {
      spinner.text = `IPNS key ${name} already exists`;
    }

    // Get the key ID
    const keyInfo = execSync("ipfs key list -l")
      .toString()
      .split("\n")
      .find((line) => line.includes(name));

    if (!keyInfo) {
      throw new Error(`Failed to find key info for ${name}`);
    }

    const keyId = keyInfo.split(" ")[0].trim();
    stopSpinner(`IPNS key ready: ${keyId}`, true);
    return keyId;
  } catch (error) {
    stopSpinner(
      `Failed to ensure IPNS key: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Publish content to IPNS
 */
export async function publishToIPNS(cid: string, keyName: string) {
  const spinner = startSpinner(
    `Publishing ${cid} to IPNS with key ${keyName}...`
  );

  try {
    const output = execSync(
      `ipfs name publish --key=${keyName} /ipfs/${cid}`
    ).toString();
    const ipnsAddress = output.match(/to (.+)/)?.[1]?.trim() || "";

    stopSpinner(`Published to IPNS: ${ipnsAddress}`, true);
    return ipnsAddress;
  } catch (error) {
    stopSpinner(
      `Failed to publish to IPNS: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Create and publish node list JSON
 */
export async function publishNodeList(nodes: NodeInfo[], appName: string) {
  const spinner = startSpinner(`Publishing node list for ${appName}...`);

  try {
    const nodeList: NodeList = {
      nodes,
      updatedAt: new Date().toISOString(),
    };

    const tempFile = path.join(config.ipfsDataPath, `${appName}-nodes.json`);
    fs.writeFileSync(tempFile, JSON.stringify(nodeList, null, 2));

    const cid = await uploadToIPFS(tempFile);
    const keyName = `${appName}-nodes`;
    await ensureIPNSKey(keyName);
    const ipnsAddress = await publishToIPNS(cid, keyName);

    fs.unlinkSync(tempFile);

    stopSpinner(`Node list published to ${ipnsAddress}`, true);
    return { cid, ipnsAddress };
  } catch (error) {
    stopSpinner(
      `Failed to publish node list: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Fetch node list from IPNS
 */
export async function fetchNodeList(ipnsPath: string): Promise<NodeList> {
  const spinner = startSpinner(`Fetching node list from ${ipnsPath}...`);

  try {
    // Resolve IPNS to CID
    const ipfsCid = execSync(`ipfs name resolve ${ipnsPath}`)
      .toString()
      .trim()
      .replace("/ipfs/", "");
    spinner.text = `Resolved IPNS to CID: ${ipfsCid}`;

    // Get file from IPFS
    const tempOutputPath = path.join(config.ipfsDataPath, "nodelist-temp.json");
    execSync(`ipfs get ${ipfsCid} -o ${tempOutputPath}`);

    // Read and parse the file
    const nodeListContent = fs.readFileSync(tempOutputPath, "utf8");
    const nodeList = JSON.parse(nodeListContent) as NodeList;

    // Clean up temp file
    fs.unlinkSync(tempOutputPath);

    stopSpinner(`Fetched node list with ${nodeList.nodes.length} nodes`, true);
    return nodeList;
  } catch (error) {
    stopSpinner(
      `Failed to fetch node list: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw new Error(
      `Failed to fetch node list: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
