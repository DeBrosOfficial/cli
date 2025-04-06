import chalk from 'chalk';
import ora from 'ora';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Current log level - can be set via environment variable
let currentLogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel) {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  const envLevel = process.env.DEBROS_LOG_LEVEL?.toLowerCase();
  
  if (envLevel === 'debug') return LogLevel.DEBUG;
  if (envLevel === 'info') return LogLevel.INFO;
  if (envLevel === 'warn') return LogLevel.WARN;
  if (envLevel === 'error') return LogLevel.ERROR;
  
  return currentLogLevel;
}

// Spinner for loading states
let spinner: ReturnType<typeof ora> | null = null;

export function startSpinner(text: string) {
  if (spinner) spinner.stop();
  spinner = ora(text).start();
  return spinner;
}

export function updateSpinner(text: string) {
  if (spinner) spinner.text = text;
}

export function stopSpinner(text?: string, success = true) {
  if (!spinner) return;
  
  if (success && text) {
    spinner.succeed(text);
  } else if (!success && text) {
    spinner.fail(text);
  } else {
    spinner.stop();
  }
  
  spinner = null;
}

// Logger functions
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (getLogLevel() <= LogLevel.DEBUG) {
      if (spinner) spinner.stop();
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
      if (spinner) spinner.start();
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (getLogLevel() <= LogLevel.INFO) {
      if (spinner) spinner.stop();
      console.log(chalk.blue(`[INFO] ${message}`), ...args);
      if (spinner) spinner.start();
    }
  },
  
  success: (message: string, ...args: any[]) => {
    if (getLogLevel() <= LogLevel.INFO) {
      if (spinner) spinner.stop();
      console.log(chalk.green(`[SUCCESS] ${message}`), ...args);
      if (spinner) spinner.start();
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (getLogLevel() <= LogLevel.WARN) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow(`[WARN] ${message}`), ...args);
      if (spinner) spinner.start();
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (getLogLevel() <= LogLevel.ERROR) {
      if (spinner) spinner.stop();
      console.error(chalk.red(`[ERROR] ${message}`), ...args);
      if (spinner) spinner.start();
    }
  },
  
  raw: (message: string) => {
    if (spinner) spinner.stop();
    console.log(message);
    if (spinner) spinner.start();
  }
};

export default logger;