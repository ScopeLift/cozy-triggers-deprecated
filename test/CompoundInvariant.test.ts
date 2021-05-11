import { artifacts, ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { MockCozyToken, MockCToken, CompoundInvariant } from '../typechain';

const { deployContract } = waffle;
const { formatBytes32String } = ethers.utils;

describe('CompoundInvariant', function () {
  let deployer: SignerWithAddress, recipient: SignerWithAddress;
  let mockCUsdc: MockCToken;
  let trigger: CompoundInvariant;
  let triggerParams: any[] = []; // trigger params deployment parameters

  before(async () => {
    [deployer, recipient] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy Mock CToken
    const mockCTokenArtifact = await artifacts.readArtifact('MockCToken');
    mockCUsdc = <MockCToken>await deployContract(deployer, mockCTokenArtifact);

    // Deploy  CompoundInvariant trigger
    triggerParams = [
      'Compound Invariant Trigger', // name
      'COMP-INV-TRIG', // symbol
      'Triggers when the Compound invariant that reserves + supply = cash + borrows is violated', // description
      [4], // platform ID for Compound
      recipient.address, // subsidy recipient
      mockCUsdc.address, // address of the Compound CToken market this trigger checks
    ];
    const compoundInvariantArtifact = await artifacts.readArtifact('CompoundInvariant');
    trigger = <CompoundInvariant>await deployContract(deployer, compoundInvariantArtifact, triggerParams);
  });

  it('deployment: should not deploy if market is already triggered', async () => {
    // Break invariant of the CToken
    await mockCUsdc.set(formatBytes32String('cash'), 0);
    expect(await mockCUsdc.getCash()).to.equal(0);

    // Try deploying the trigger
    const compoundInvariantArtifact = await artifacts.readArtifact('CompoundInvariant');
    await expect(deployContract(deployer, compoundInvariantArtifact, triggerParams)).to.be.revertedWith(
      'Market already triggered'
    );
  });

  it('checkAndToggleTrigger: does nothing when called on a valid market', async () => {
    expect(await trigger.isTriggered()).to.be.false;
    await trigger.checkAndToggleTrigger();
    expect(await trigger.isTriggered()).to.be.false;
  });

  it('checkAndToggleTrigger: toggles trigger when called on a broken market', async () => {
    expect(await trigger.isTriggered()).to.be.false;
    await mockCUsdc.set(formatBytes32String('totalSupply'), 0);
    expect(await trigger.isTriggered()).to.be.false; // trigger not updated yet, so still expect false
    const tx = await trigger.checkAndToggleTrigger();
    await expect(tx).to.emit(trigger, 'TriggerActivated');
    expect(await trigger.isTriggered()).to.be.true;
  });

  it('checkAndToggleTrigger: returns a boolean with the value of isTriggered', async () => {
    // Deploy our helper contract for testing, which has a state variable called isTriggered that stores the last
    // value returned from trigger.checkAndToggleTrigger()
    const mockCozyTokenArtifact = await artifacts.readArtifact('MockCozyToken');
    const mockCozyToken = <MockCozyToken>await deployContract(deployer, mockCozyTokenArtifact, [trigger.address]);
    expect(await mockCozyToken.isTriggered()).to.be.false;

    // Break the CToken
    await mockCUsdc.set(formatBytes32String('totalReserves'), 0);
    await mockCozyToken.checkAndToggleTrigger();
    expect(await mockCozyToken.isTriggered()).to.be.true;
  });

  it('tolerance: only considers invariant as violated when > 0.000001% error', async () => {
    // Duplicate the logic from the isMarketTriggered method
    const getPercent = (reserves: bigint, borrows: bigint, supply: bigint, exchangeRate: bigint, cash: bigint) => {
      const lhs = (supply * exchangeRate) / WAD + reserves;
      const rhs = cash + borrows;
      const diff = lhs > rhs ? lhs - rhs : rhs - lhs;
      const denominator = lhs < rhs ? lhs : rhs;
      return (diff * WAD) / denominator;
    };

    // Read the tolerance from the contract and verify the value
    const tolerance = (await trigger.tolerance()).toBigInt();
    expect(tolerance).to.equal(10n ** 12n); // 10^12 = 10^-6 * 10^18 = 0.000001%

    // Use the same values we initialize the MockCToken with
    const WAD = 10n ** 18n;
    let totalReserves = 5359893964073n; // units of USDC
    let totalBorrows = 3681673803163527n; // units of USDC
    let totalSupply = 20287132947568793418n; // units of cUSDC
    let exchangeRateStored = 219815665774648n; // units of 10^(18 + underlyingDecimals - 8)
    let cash = 783115726329188n; // units of USDC

    // Calculate the initial percent error using the same method as the contract
    const percent1 = getPercent(totalReserves, totalBorrows, totalSupply, exchangeRateStored, cash);

    // This percent should be smaller than our tolerance
    expect(percent1 < tolerance).to.be.true;

    // Because it's within tolerance, trigger should not toggle
    await trigger.checkAndToggleTrigger();
    expect(await trigger.isTriggered()).to.be.false;

    // Define new values that put the error slightly above our tolerance
    totalReserves = 10000000000n;
    totalBorrows = 10000n;
    totalSupply = 10000000000n;
    exchangeRateStored = 100000n;
    cash = 10000000001n;
    await mockCUsdc.set(formatBytes32String('totalReserves'), totalReserves.toString());
    await mockCUsdc.set(formatBytes32String('totalBorrows'), totalBorrows.toString());
    await mockCUsdc.set(formatBytes32String('totalSupply'), totalSupply.toString());
    await mockCUsdc.set(formatBytes32String('exchangeRateStored'), exchangeRateStored.toString());
    await mockCUsdc.set(formatBytes32String('cash'), cash.toString());

    const percent2 = getPercent(totalReserves, totalBorrows, totalSupply, exchangeRateStored, cash);
    expect(percent2 > tolerance).to.be.true;
    // Our tolerance of 0.000001% = 1000000000000 as a wad
    // New percent error =          1000100000000 as a wad
    // Therefore difference =           100000000 as a wad
    expect(percent2 - tolerance).to.equal(100000000n);

    // Because it's outside tolerance, trigger should toggle
    await trigger.checkAndToggleTrigger();
    expect(await trigger.isTriggered()).to.be.true;
  });
});
