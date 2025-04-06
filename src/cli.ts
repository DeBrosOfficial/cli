#!/usr/bin/env node
import { program } from "commander";
import { uploadCommand } from "./commands/upload.js";
import { deployCommand } from "./commands/deploy.js";
import { listCommand } from "./commands/list.js";
import { configureIPNSCommand } from "./commands/configure-ipns.js";
import { domainCommand } from "./commands/domain.js";
import { versionsCommand } from "./commands/versions.js";
import { rollbackCommand } from "./commands/rollback.js";
import { stopCommand } from "./commands/stop.js";
import { startCommand } from "./commands/start.js";
import { deleteCommand } from "./commands/delete.js";

// Main CLI setup
program
  .name("debros")
  .description(
    "DeBros CLI - Deploy and manage applications on the DeBros network"
  )
  .version("0.0.10-alpha");

// Register commands
uploadCommand(program);
deployCommand(program);
listCommand(program);
configureIPNSCommand(program);
domainCommand(program);
versionsCommand(program);
rollbackCommand(program);
stopCommand(program);
startCommand(program);
deleteCommand(program);

// Execute the CLI with the provided arguments
program.parse(process.argv);
