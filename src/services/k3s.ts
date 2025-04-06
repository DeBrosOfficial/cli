import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { logger, startSpinner, stopSpinner } from "../utils/logger.js";
import { config } from "../utils/config.js";

/**
 * Check if K3s is installed
 */
export function isK3sInstalled(): boolean {
  try {
    execSync("which k3s", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install K3s if not already installed
 */
export async function installK3s() {
  const spinner = startSpinner("Installing K3s...");

  try {
    if (isK3sInstalled()) {
      stopSpinner("K3s is already installed", true);
      return true;
    }

    logger.info("Installing K3s...");

    // Use the official K3s install script
    execSync("curl -sfL https://get.k3s.io | sh -");

    // Wait a moment for K3s to initialize
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify installation
    if (!isK3sInstalled()) {
      throw new Error("K3s installation failed");
    }

    // Set permissions for the current user to access kubectl
    execSync("sudo chmod 644 /etc/rancher/k3s/k3s.yaml");
    execSync("mkdir -p $HOME/.kube");
    execSync("sudo cp /etc/rancher/k3s/k3s.yaml $HOME/.kube/config");
    execSync("sudo chown $(id -u):$(id -g) $HOME/.kube/config");

    // Set the KUBECONFIG environment variable
    process.env.KUBECONFIG = `${process.env.HOME}/.kube/config`;

    stopSpinner("K3s installed successfully", true);
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to install K3s: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Deploy an application to K3s
 *
 * All applications run on standardized port 8787 internally, which is mapped to port 80
 * on the host via Nginx. Each application is deployed with 2 replicas by default for redundancy.
 */
export async function deployToK3s(
  appName: string,
  imageName: string,
  namespace: string = "debros-apps", // Standard namespace for all DeBros applications
  port: number = 8787, // Standard port for all DeBros applications
  replicas: number = 2, // Default to 2 replicas for redundancy
  envVars: { [key: string]: string } = {}
) {
  const spinner = startSpinner(`Deploying ${appName} to K3s...`);

  try {
    // Ensure K3s is installed
    if (!isK3sInstalled()) {
      await installK3s();
    }

    // Create namespace if it doesn't exist
    try {
      execSync(`kubectl get namespace ${namespace}`);
    } catch (error) {
      execSync(`kubectl create namespace ${namespace}`);
      logger.info(`Created namespace: ${namespace}`);
    }

    // Create a temporary directory for Kubernetes manifests
    const tempDir = path.join(config.ipfsDataPath, "k3s-manifests");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Merge with standard environment variables
    const standardEnvVars = {
      PORT: port.toString(),
      DEBROS_APP_NAME: appName,
      ...envVars,
    };

    // Create a deployment YAML
    const deploymentYaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  namespace: ${namespace}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
    spec:
      containers:
      - name: ${appName}
        image: ${imageName}
        ports:
        - containerPort: ${port}
        env:
${Object.entries(standardEnvVars)
  .map(([key, value]) => `        - name: ${key}\n          value: "${value}"`)
  .join("\n")}
`;

    // Create a service YAML
    const serviceYaml = `
apiVersion: v1
kind: Service
metadata:
  name: ${appName}-service
  namespace: ${namespace}
spec:
  selector:
    app: ${appName}
  ports:
  - port: 80              # Standard external port 
    targetPort: ${port}   # Maps to the app's internal port (8787)
  type: ClusterIP
`;

    // Create an Ingress YAML for Nginx
    const ingressYaml = `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${appName}-ingress
  namespace: ${namespace}
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: ${appName.replace(/\.debros\.sol$/i, "")}.${config.defaultDomain}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${appName}-service
            port:
              number: 80    # Standard port 80 for all ingress traffic
`;

    // Write the manifests to files
    const deploymentFile = path.join(tempDir, `${appName}-deployment.yaml`);
    const serviceFile = path.join(tempDir, `${appName}-service.yaml`);
    const ingressFile = path.join(tempDir, `${appName}-ingress.yaml`);

    fs.writeFileSync(deploymentFile, deploymentYaml);
    fs.writeFileSync(serviceFile, serviceYaml);
    fs.writeFileSync(ingressFile, ingressYaml);

    // Apply the manifests
    execSync(`kubectl apply -f ${deploymentFile}`);
    execSync(`kubectl apply -f ${serviceFile}`);
    execSync(`kubectl apply -f ${ingressFile}`);

    stopSpinner(`${appName} deployed to K3s successfully`, true);

    // Clean up the temporary files
    fs.unlinkSync(deploymentFile);
    fs.unlinkSync(serviceFile);
    fs.unlinkSync(ingressFile);

    return {
      appName,
      namespace,
      url: `http://${appName}.${config.defaultDomain}`,
    };
  } catch (error) {
    stopSpinner(
      `Failed to deploy to K3s: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Install Nginx Ingress Controller for K3s
 */
export async function installNginxIngress() {
  const spinner = startSpinner("Installing Nginx Ingress Controller...");

  try {
    // Ensure K3s is installed
    if (!isK3sInstalled()) {
      await installK3s();
    }

    // Apply the Nginx Ingress Controller manifest
    execSync(
      "kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml"
    );

    // Wait for the controller to be ready
    execSync(
      "kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s"
    );

    stopSpinner("Nginx Ingress Controller installed successfully", true);
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to install Nginx Ingress Controller: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * List all applications deployed on K3s
 */
export async function listK3sDeployments(namespace: string = "default") {
  const spinner = startSpinner(
    `Listing deployments in namespace ${namespace}...`
  );

  try {
    // Ensure K3s is installed
    if (!isK3sInstalled()) {
      await installK3s();
    }

    const output = execSync(
      `kubectl get deployments -n ${namespace} -o json`
    ).toString();
    const deployments = JSON.parse(output);

    stopSpinner(`Found ${deployments.items.length} deployments`, true);
    return deployments.items;
  } catch (error) {
    stopSpinner(
      `Failed to list deployments: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Delete an application from K3s
 */
export async function deleteK3sDeployment(
  appName: string,
  namespace: string = "default"
) {
  const spinner = startSpinner(`Deleting ${appName} from K3s...`);

  try {
    // Ensure K3s is installed
    if (!isK3sInstalled()) {
      await installK3s();
    }

    // Delete the deployment, service, and ingress
    execSync(`kubectl delete deployment ${appName} -n ${namespace}`);
    execSync(`kubectl delete service ${appName}-service -n ${namespace}`);
    execSync(`kubectl delete ingress ${appName}-ingress -n ${namespace}`);

    stopSpinner(`${appName} deleted from K3s successfully`, true);
    return true;
  } catch (error) {
    stopSpinner(
      `Failed to delete deployment: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}
