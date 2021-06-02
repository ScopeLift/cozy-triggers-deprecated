import { Contract, ContractFactory } from 'ethers';
// We require the Hardhat Runtime Environment explicitly here. This is optional but useful for running the script in
// a standalone fashion through `node <script>`. When running the script with `hardhat run <script>` you'll find the
// Hardhat Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat';

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it. If this runs in a standalone fashion you
  // may want to call compile manually to make sure everything is compiled
  // await run("compile");

  // Define constructor parameters for CompoundExchangeRate trigger
  const triggerParams = [
    'Compound Exchange Rate Trigger', // name
    'COMP-ER-TRIG', // symbol
    'Triggers when the Compound exchange rate decreases', // description
    [4], // platform ID for Compound
    '0x0000000000000000000000000000000000000000', // TODO set subsidy recipient
    '0x0000000000000000000000000000000000000000', // TODO set address of the Compound CToken market this trigger checks
  ];

  // We get the contract to deploy
  // NOTE: This will fail until a real CToken address is set because of the exchangeRateStored() call in the constructor
  const CompoundExchangeRate: ContractFactory = await ethers.getContractFactory('CompoundExchangeRate');
  const compoundExchangeRate: Contract = await CompoundExchangeRate.deploy(...triggerParams);
  await compoundExchangeRate.deployed();

  console.log('CompoundExchangeRate deployed to: ', compoundExchangeRate.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
