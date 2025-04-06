import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import Dockerode from "dockerode";
import { logger, startSpinner, stopSpinner } from "../utils/logger.js";
import { config } from "../utils/config.js";

// Docker client instance
const docker = new Dockerode();

/**
 * Build a Docker image from a folder
 */
export async function buildDockerImage(
  folderPath: string,
  imageName: string,
  tag: string = "latest",
  additionalArgs: string[] = []
) {
  const fullImageName = `${config.dockerRegistry}/${imageName}:${tag}`;
  const spinner = startSpinner(`Building Docker image: ${fullImageName}`);

  try {
    // Verify directory exists
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    // Check for Dockerfile
    const dockerfilePath = path.join(folderPath, "Dockerfile");
    if (!fs.existsSync(dockerfilePath)) {
      throw new Error("Dockerfile not found in the specified folder");
    }

    // Prepare build command
    let buildCommand = `docker build -t ${fullImageName} ${additionalArgs.join(
      " "
    )} ${folderPath}`;
    logger.debug(`Executing build command: ${buildCommand}`);

    // Execute the build
    const output = execSync(buildCommand, { stdio: "pipe" }).toString();
    stopSpinner(`Docker image built: ${fullImageName}`, true);

    return {
      imageName: fullImageName,
      output,
    };
  } catch (error) {
    stopSpinner(
      `Failed to build Docker image: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Save a Docker image to a tar file
 */
export async function saveDockerImage(imageName: string, outputPath: string) {
  const spinner = startSpinner(
    `Saving Docker image ${imageName} to ${outputPath}`
  );

  try {
    const command = `docker save -o ${outputPath} ${imageName}`;
    execSync(command);
    stopSpinner(`Docker image saved to ${outputPath}`, true);
    return outputPath;
  } catch (error) {
    stopSpinner(
      `Failed to save Docker image: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Load a Docker image from a tar file
 */
export async function loadDockerImage(tarPath: string) {
  const spinner = startSpinner(`Loading Docker image from ${tarPath}`);

  try {
    const command = `docker load -i ${tarPath}`;
    const output = execSync(command).toString();

    // Extract the image name from the output
    const loadedImage = output.match(/Loaded image: (.+)/)?.[1];
    stopSpinner(`Docker image loaded: ${loadedImage || "unknown"}`, true);

    return {
      imagePath: tarPath,
      loadedImage,
    };
  } catch (error) {
    stopSpinner(
      `Failed to load Docker image: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * List all Docker images with the debros registry
 */
export async function listDebrosImages() {
  const spinner = startSpinner("Listing DeBros Docker images");

  try {
    const images = await docker.listImages();
    const debrosImages = images.filter((image) => {
      return (
        image.RepoTags &&
        image.RepoTags.some((tag) =>
          tag.startsWith(`${config.dockerRegistry}/`)
        )
      );
    });

    stopSpinner(`Found ${debrosImages.length} DeBros images`, true);
    return debrosImages;
  } catch (error) {
    stopSpinner(
      `Failed to list Docker images: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}

/**
 * Run a Docker container
 */
export async function runContainer(
  imageName: string,
  containerName: string,
  ports: { [key: string]: string } = {},
  envVars: { [key: string]: string } = {},
  volumes: { [key: string]: string } = {}
) {
  const spinner = startSpinner(
    `Starting container ${containerName} from image ${imageName}`
  );

  try {
    // Prepare port bindings
    const portBindings: any = {};
    const exposedPorts: any = {};

    Object.entries(ports).forEach(([containerPort, hostPort]) => {
      const portKey = `${containerPort}/tcp`;
      exposedPorts[portKey] = {};
      portBindings[portKey] = [{ HostPort: hostPort }];
    });

    // Prepare environment variables
    const env = Object.entries(envVars).map(
      ([key, value]) => `${key}=${value}`
    );

    // Prepare volumes
    const volumeBinds = Object.entries(volumes).map(
      ([hostPath, containerPath]) => `${hostPath}:${containerPath}`
    );

    // Create container
    const container = await docker.createContainer({
      Image: imageName,
      name: containerName,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: volumeBinds,
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
      Env: env,
    });

    // Start the container
    await container.start();

    stopSpinner(`Container ${containerName} started successfully`, true);
    return container;
  } catch (error) {
    stopSpinner(
      `Failed to start container: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
    throw error;
  }
}
