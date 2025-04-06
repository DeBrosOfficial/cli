# DeBros CLI

Command-line interface for managing applications on the DeBros decentralized network. This CLI runs on your local development machine, allowing you to build, upload, and deploy applications to the DeBros network from your local environment.

## Overview

DeBros CLI allows you to:

- Build and upload applications to the DeBros network
- Deploy applications to your local node
- Configure domains with IPNS for your applications
- Manage .sol domains for easy access to your applications
- Set up K3s with Nginx for container orchestration

## Installation

### Quick Install Script

The easiest way to install the DeBros CLI on your local machine is using our install script:

```bash
curl -sL https://raw.githubusercontent.com/DeBrosOfficial/node/main/packages/@debros/cli/install-cli.sh | bash
```

This script will:

1. Check for Node.js, Docker, and IPFS dependencies
2. Install IPFS if needed (with your permission)
3. Install the DeBros CLI globally
4. Set up the necessary configuration directories

### Manual Installation

Alternatively, you can install manually:

```bash
# Global installation with npm
npm install -g @debros/cli

# Or with pnpm
pnpm install -g @debros/cli

# Or with yarn
yarn global add @debros/cli
```

## Prerequisites

- Node.js 18+
- Docker
- IPFS (for some commands)
- K3s (optional, for container orchestration)

## Getting Started

Initialize the CLI and environment:

```bash
debros init
```

This will guide you through setting up your environment, including K3s and Nginx if desired.

## Commands

### Upload an Application (and Update)

```bash
debros upload <folder> [options]
```

Options:

- `-t, --tag <tag>`: Docker image tag (default: "latest")
- `-n, --name <name>`: Application name (defaults to folder name)
- `-d, --domain <subdomain>`: Custom subdomain (only specify the part before .debros.sol)

Example:

```bash
# Using default subdomain (awesome-app.debros.sol)
debros upload ./my-app -n awesome-app -t v1.0.0

# Using custom subdomain (api-myproject.debros.sol)
debros upload ./my-app -n awesome-app -d api-myproject

# Update an existing application
# (uploading with the same name will update the existing deployment)
debros upload ./my-app -n awesome-app -t v1.1.0
```

The upload command is used both for initial deployment and for updates. When you upload a new version of an existing application, the network automatically updates the deployment.

### Deploy Locally

```bash
debros deploy <image-path> [options]
```

Options:

- `-n, --name <name>`: Application name (if not provided, derived from image name)

Note: All applications run on port 8787 internally and are automatically deployed with 2 replicas for redundancy in the 'debros-apps' namespace. External access is standardized through port 80 via Nginx using K3s.

Example:

```bash
debros deploy awesome-app.tar -n awesome-app
```

### List Deployments and Network

```bash
debros list [options]
```

Options:

- `-a, --apps`: List deployed applications
- `-n, --nodes`: List network nodes
- `-i, --images`: List local Docker images
- `-d, --detailed`: Show detailed information

### List Application Versions

```bash
debros versions <app-name>
```

Example:

```bash
debros versions awesome-app
```

This will show all available versions of the application along with their upload timestamps and deployment status.

### Rollback Application

```bash
debros rollback <app-name> [version-tag]
```

Options:

- `-f, --force`: Force rollback without confirmation

Example:

```bash
# Rollback to a specific version
debros rollback awesome-app v1.0.0

# Rollback to the previous version
debros rollback awesome-app
```

### Stop Application

```bash
debros stop <app-name>
```

Options:

- `-f, --force`: Force stop without confirmation

Example:

```bash
debros stop awesome-app
```

### Start Application

```bash
debros start <app-name>
```

Options:

- `-v, --version <version>`: Version tag to start (defaults to latest)

Example:

```bash
# Start with latest version
debros start awesome-app

# Start with specific version
debros start awesome-app -v v1.0.0
```

### Delete Application

```bash
debros delete <app-name>
```

Options:

- `-f, --force`: Force delete without confirmation

Example:

```bash
debros delete awesome-app
```

### Configure IPNS

```bash
debros configure-ipns <name> <cid>
```

Example:

```bash
debros configure-ipns awesome-app QmXYZ123...
```

### Domain Management

Check domain availability:

```bash
debros domain check <domain>
```

Register a domain:

```bash
debros domain register <domain>
```

Link a domain to IPNS:

```bash
debros domain link <domain> <ipns-address>
```

Set up a domain with application and IPNS in one step:

```bash
debros domain setup <domain> <cid>
```

## Docker Deployment vs K3s

The CLI supports two deployment strategies:

1. **Docker**: Simple container deployment on a single node
2. **K3s**: Kubernetes-based orchestration with Nginx for routing

K3s is recommended for production deployments as it provides better scaling, failover, and routing capabilities.

## Example Workflow

Here's a typical workflow for deploying an application to the DeBros network:

```bash
# 1. Initialize the CLI on your local machine
debros init

# 2. Upload your application to the network
# IMPORTANT: Your application should listen on port 8787 internally
debros upload ./my-app
# Or with a custom subdomain
debros upload ./my-app -d api-myservice

# This will:
# - Build a Docker image from your application folder
# - Save the image to a tar file
# - Upload the tar file to IPFS, getting a CID
# - Announce the deployment to the network
# - DeBros nodes will automatically pull and deploy your application with 2 replicas
# - Your application gets the subdomain: my-app.debros.sol (or api-myservice.debros.sol)
# - External traffic is managed via Nginx routing based on domain name

# 3. List your deployments and network nodes
debros list

# 4. Update your application (when you make changes)
debros upload ./my-app -t v1.1.0

# 5. View version history and manage versions
debros versions my-app

# 6. Rollback to a previous version if needed
debros rollback my-app v1.0.0

# 7. Stop, start, and delete applications
debros stop my-app
debros start my-app
debros delete my-app
debros domain setup my-app.debros.sol QmXYZ123...

# 5. Check if your application is deployed on the network
debros list -a
```

## Deployment Process Overview

When you use the DeBros CLI to deploy an application to the network:

1. Your application is dockerized and should listen on port 8787
2. The CLI builds, uploads and announces the app to the network
3. You specify a subdomain (e.g., "anchat-api") that will be used to access your app
4. The CLI automatically appends ".debros.sol" to your subdomain
5. DeBros nodes automatically pull and deploy your application with K3s and Nginx
6. Your app becomes accessible at the specified domain (e.g., anchat-api.debros.sol)
7. All routing between domains and apps is handled transparently by the network

## Standardized Application Configuration

For consistency and reliability across the DeBros network, all applications follow these standardized rules:

**Port Standardization**:

- All applications **MUST** listen on port 8787 internally
- External traffic is routed through port 80 via Nginx
- Domain-based routing (app-name.debros.sol) handles multiple applications on the same nodes
- Port configuration is handled automatically by the CLI and node infrastructure

**Replica Management**:

- All applications are automatically deployed with 2 replicas for redundancy
- Replicas are distributed across different nodes when possible
- If a node fails, traffic is automatically routed to healthy replicas
- Scaling is handled transparently by the network

**Environment Variables**:

- The following environment variables are automatically set:
  - `PORT=8787`: Tells your application which port to listen on
  - `DEBROS_APP_NAME`: Your application's name on the network

## Remote vs Local Operations

The DeBros CLI distinguishes between operations on your local machine and operations that interact with the DeBros network:

**Local Operations**:

- Building Docker images
- Uploading files to IPFS
- Managing local K3s deployments

**Network Operations**:

- Discovering network nodes
- Announcing deployments to the network
- Managing node lists and application distribution
- Setting up domains and IPNS

## IPFS and IPNS

The CLI integrates with IPFS and IPNS to provide decentralized content addressing and name resolution. This allows you to:

- Store application images and data on IPFS
- Use IPNS for stable naming despite content changes
- Link .sol domains to your IPNS addresses

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[GNU GPL v3.0](LICENSE)
