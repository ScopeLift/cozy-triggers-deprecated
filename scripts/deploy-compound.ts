import { Contract, ContractFactory } from 'ethers';
import { ethers, network } from 'hardhat';
import axios from 'axios';
import chalk from 'chalk';
import readline from 'readline';

const { BigNumber } = ethers;
const { formatUnits } = ethers.utils;

// Helper method to fetch JSON
const fetch = (url: string) => axios.get(url).then((res) => res);

// Get latest mainnet gas price
async function getGasPrice() {
  try {
    const response = await fetch('https://www.gasnow.org/api/v3/gas/price');
    const gasPrice = BigNumber.from(response.data.data.rapid).mul('110').div('100'); // bump returned gas price by 10%
    console.log(chalk.dim(`  Using gasPrice of ${formatUnits(gasPrice, 'gwei')} gwei`));
    return gasPrice;
  } catch (e) {
    // Gas price to fallback to if API call in getGasPrice() is not available
    const fallbackGasPrice = BigNumber.from('50000000000'); // 50 gwei
    console.log(`Could not fetch gas price. Using fallback gas price ${formatUnits(fallbackGasPrice, 'gwei')} gwei`);
    return fallbackGasPrice;
  }
}

// Helper method for waiting on user input. Source: https://stackoverflow.com/a/50890409
const waitForInput = (query: string) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};

// Logging helper methods
const logError = (msg: string) => console.log(`  ${chalk.red('\u2717')} Error: ${msg}. See above for details`); // \u2717 = x symbol
const logHeader = (header: string) => console.log(chalk.magenta.bold(`\n${header}`));
const logDeploy = (contractName: string, address: string) =>
  console.log(`  ${chalk.green('\u2713')} Deployed: ${contractName} to ${address}`); // \u2713 = check symbol

// Main deployment
async function main(): Promise<void> {
  // SETUP
  let deployerPrivateKey: string;
  if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error('Please set your DEPLOYER_PRIVATE_KEY in a .env file');
  else deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const deployerWallet = new ethers.Wallet(deployerPrivateKey);

  // VERIFICATION
  // Verify sure the user is ok with the provided inputs
  console.log(chalk.bold.yellow('\nPLEASE VERIFY THE BELOW PARAMETERS\n'));
  console.log(`  Deployer address:    ${deployerWallet.address}`);
  console.log(`  Deploying to:        ${network.name}\n`);
  const response = await waitForInput('Do you want to continue with deployment? y/N\n');
  if (response !== 'y') {
    logError('User chose to cancel deployment. Exiting script');
    return;
  }
  console.log(`  ${chalk.green('\u2713')} Continuing with deployment...\n`);

  // DEFINE PARAMETERS
  // Define constructor parameters for CompoundExchangeRate trigger
  const compoundTriggerParams = [
    'Compound USDC Exchange Rate Trigger', // name
    'cUSDC-ER-TRIG', // symbol
    'Triggers when the Compound USDC token exchange rate decreases', // description
    [4], // platform ID for Compound
    deployerWallet.address, // subsidy recipient is deployer
    '0x39AA39c021dfbaE8faC545936693aC917d5E7563', // This is the cUSDC address
  ];

  // EXECUTE DEPLOYMENTS
  logHeader('Deployments');

  // Deploy the contract
  // NOTE: This will fail unless CToken address parameter is real on mainnet, because of the exchangeRateStored() call
  //in the constructor
  const CompoundExchangeRate: ContractFactory = await ethers.getContractFactory('CompoundExchangeRate');
  const compoundExchangeRate: Contract = await CompoundExchangeRate.deploy(...compoundTriggerParams);
  await compoundExchangeRate.deployed();
  logDeploy('CompoundExchangeRate USDC Trigger', compoundExchangeRate.address);

  // DONE
  console.log(chalk.green.bold('\n🎉 🥳 🎉 Deployment complete! 🎉 🥳 🎉'));
  console.log('Be sure to save off the above trigger address somewhere!\n');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
