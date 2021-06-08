import { Contract, ContractFactory } from 'ethers';
import { ethers, network } from 'hardhat';
import axios from 'axios';
import chalk from 'chalk';
import readline from 'readline';

const { BigNumber } = ethers;
const { formatUnits, parseUnits } = ethers.utils;

// Helper method to fetch JSON
const fetch = (url: string) => axios.get(url).then((res) => res);

// Get latest mainnet gas price
async function getGasPrice() {
  try {
    const response = await fetch('https://www.gasnow.org/api/v3/gas/price');
    const gasPrice = BigNumber.from(response.data.data.rapid).mul('110').div('100'); // bump returned gas price by 10%
    return gasPrice;
  } catch (e) {
    // Gas price to fallback to if API call fails
    const fallbackGasPrice = parseUnits('50', 'gwei');
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
  const gasPrice = await getGasPrice();

  // VERIFICATION
  // Verify sure the user is ok with the provided inputs
  console.log(chalk.bold.yellow('\nPLEASE VERIFY THE BELOW PARAMETERS\n'));
  console.log(`  Deployer address:    ${deployerWallet.address}`);
  console.log(`  Deploying to:        ${network.name}`);
  console.log(`  Gas price (gwei):    ${formatUnits(gasPrice, 'gwei')}\n`);

  const response = await waitForInput('Do you want to continue with deployment? y/N\n');
  if (response !== 'y') {
    logError('User chose to cancel deployment. Exiting script');
    return;
  }
  console.log(`  ${chalk.green('\u2713')} Continuing with deployment...\n`);

  // DEFINE PARAMETERS
  // Define constructor parameters for trigger
  const triggerParams = [
    'Yearn USDC V2 Vault Share Price Trigger', // name
    'yUSDC-V2-SP-TRIG', // symbol
    'Triggers when the Yearn USDC V2 vault share price decreases', // description
    [1], // platform ID for Yearn
    deployerWallet.address, // subsidy recipient is deployer
    '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9', // This is the yUSDC vault address
  ];

  // EXECUTE DEPLOYMENTS
  logHeader('Deployments');
  const overrides = { gasPrice };
  const triggerFactory: ContractFactory = await ethers.getContractFactory('YearnV2SharePrice');
  console.log(chalk.dim('    Deployment in progress...'));
  const trigger: Contract = await triggerFactory.deploy(...triggerParams, overrides);
  await trigger.deployed();
  logDeploy('YearnV2SharePrice USDC Trigger', trigger.address);

  // DONE
  console.log(chalk.green.bold('\n🎉 🥳 🎉 Deployment complete! 🎉 🥳 🎉'));
  console.log('Be sure to save off the above trigger address somewhere!\n');
}

// Execute script
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
