declare module '@debros/cli' {
  // Core interfaces for node and network information
  export interface NodeInfo {
    id: string;
    address: string;
    port: number;
    load: number;
    type: "k3s" | "docker";
  }

  export interface NodeList {
    nodes: NodeInfo[];
    updatedAt: string;
  }

  // Configuration interface
  export interface DebrosCliConfig {
    ipfsDataPath: string;
    ipnsKeysPath: string;
    dockerRegistry: string;
    bootstrapNodes: string[];
    defaultDomain: string;
    solanaEndpoint: string;
    defaultDeploymentStrategy: "k3s" | "docker";
  }

  // IPFS services
  export function initializeIpfs(): Promise<{ ipfs: any; libp2p: any }>;
  export function uploadToIPFS(filePath: string): Promise<string>;
  export function ensureIPNSKey(name: string): Promise<string>;
  export function publishToIPNS(cid: string, keyName: string): Promise<string>;
  export function publishNodeList(nodes: NodeInfo[], appName: string): Promise<{ cid: string; ipnsAddress: string }>;
  export function fetchNodeList(ipnsPath: string): Promise<NodeList>;

  // Docker services
  export function buildDockerImage(
    folderPath: string,
    imageName: string,
    tag?: string,
    additionalArgs?: string[]
  ): Promise<{ imageName: string; output: string }>;
  export function saveDockerImage(imageName: string, outputPath: string): Promise<string>;
  export function loadDockerImage(tarPath: string): Promise<{ imagePath: string; loadedImage: string | undefined }>;
  export function runContainer(
    imageName: string,
    containerName: string,
    ports?: { [key: string]: string },
    envVars?: { [key: string]: string },
    volumes?: { [key: string]: string }
  ): Promise<any>;

  // Network services
  export function getPeers(): Promise<any>;
  export function getPeersAsNodeInfo(): Promise<NodeInfo[]>;
  export function announceDeployment(
    cid: string,
    appName: string,
    version?: string,
    domain?: string
  ): Promise<boolean>;
  export function listenForDeployments(
    callback: (message: { cid: string; appName: string; version: string; domain: string }) => void
  ): Promise<boolean>;
  export function getAppVersions(appName: string): Promise<Array<{
    tag: string;
    cid: string;
    timestamp: string;
    deployed: boolean;
  }>>;
  export function rollbackToVersion(
    appName: string,
    versionTag?: string,
    domain?: string,
    force?: boolean
  ): Promise<{ success: boolean; message?: string; version?: string; cid?: string }>;
  export function startApplication(
    appName: string,
    versionTag?: string
  ): Promise<{ success: boolean; message?: string }>;
  export function stopApplication(
    appName: string,
    force?: boolean
  ): Promise<{ success: boolean; message?: string }>;
  export function deleteApplication(
    appName: string,
    force?: boolean
  ): Promise<{ success: boolean; message?: string }>;
}