import { artifacts, ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { MockCozyToken, MockYVault, YearnSharePrice } from '../typechain';

const { deployContract } = waffle;

describe('YearnSharePrice', function () {
  let deployer: SignerWithAddress, recipient: SignerWithAddress;
  let mockYUsdc: MockYVault;
  let trigger: YearnSharePrice;
  let triggerParams: (string | number[])[] = []; // trigger params deployment parameters

  before(async () => {
    [deployer, recipient] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy Mock yVault
    const mockYVaultArtifact = await artifacts.readArtifact('MockYVault');
    mockYUsdc = <MockYVault>await deployContract(deployer, mockYVaultArtifact);

    // Deploy YearnSharePrice trigger
    triggerParams = [
      'Yearn USDC Vault Share Price Trigger', // name
      'yUSDC-SP-TRIG', // symbol
      'Triggers when the Yearn USDC vault share price decreases', // description
      [1], // platform ID for Yearn
      recipient.address, // TODO set subsidy recipient
      mockYUsdc.address, // TODO set address of the yVault market this trigger checks
    ];

    const YearnSharePriceArtifact = await artifacts.readArtifact('YearnSharePrice');
    trigger = <YearnSharePrice>await deployContract(deployer, YearnSharePriceArtifact, triggerParams);
  });

  describe('Deployment', () => {
    it('initializes properly', async () => {
      expect(await trigger.name()).to.equal(triggerParams[0]);
      expect(await trigger.symbol()).to.equal(triggerParams[1]);
      expect(await trigger.description()).to.equal(triggerParams[2]);
      const platformIds = (await trigger.getPlatformIds()).map((id) => id.toNumber());
      expect(platformIds).to.deep.equal(triggerParams[3]); // use `.deep.equal` to compare array equality
      expect(await trigger.recipient()).to.equal(triggerParams[4]);
      expect(await trigger.market()).to.equal(triggerParams[5]);
      expect(await trigger.tolerance()).to.equal('10000');
    });
  });

  describe('checkAndToggleTrigger', () => {
    it('does nothing when called on a valid market', async () => {
      expect(await trigger.isTriggered()).to.be.false;
      await trigger.checkAndToggleTrigger();
      expect(await trigger.isTriggered()).to.be.false;
    });

    it('toggles trigger when called on a broken market', async () => {
      expect(await trigger.isTriggered()).to.be.false;

      await mockYUsdc.set(1);
      expect(await trigger.isTriggered()).to.be.false; // trigger not updated yet, so still expect false

      const tx = await trigger.checkAndToggleTrigger();
      await expect(tx).to.emit(trigger, 'TriggerActivated');
      expect(await trigger.isTriggered()).to.be.true;
    });

    it('returns a boolean with the value of isTriggered', async () => {
      // Deploy our helper contract for testing, which has a state variable called isTriggered that stores the last
      // value returned from trigger.checkAndToggleTrigger()
      const mockCozyTokenArtifact = await artifacts.readArtifact('MockCozyToken');
      const mockCozyToken = <MockCozyToken>await deployContract(deployer, mockCozyTokenArtifact, [trigger.address]);
      expect(await mockCozyToken.isTriggered()).to.be.false;

      // Break the yVault
      await mockYUsdc.set(1);
      await mockCozyToken.checkAndToggleTrigger();
      expect(await mockCozyToken.isTriggered()).to.be.true;
    });

    it('properly updates the saved state', async () => {
      // Get initial state
      const initialPricePerShare = (await trigger.lastPricePerShare()).toBigInt();

      // Update share price
      const newPricePerShare = initialPricePerShare + 250n;
      await mockYUsdc.set(newPricePerShare);

      // Call checkAndToggleTrigger to simulate someone using the protocol
      await trigger.checkAndToggleTrigger();
      expect(await trigger.isTriggered()).to.be.false; // sanity check

      // Verify the new state
      const currentPricePerShare = await trigger.lastPricePerShare();
      expect(currentPricePerShare.toString()).to.equal(newPricePerShare.toString()); // bigint checks are flaky with chai
    });

    it('properly accounts for tolerance', async () => {
      // Modify the currently stored share price by a set tolerance
      async function modifyLastPricePerShare(amount: bigint) {
        const lastPricePerShare = (await trigger.lastPricePerShare()).toBigInt();
        const newPricePerShare = lastPricePerShare + amount;
        await mockYUsdc.set(newPricePerShare);
        expect(await mockYUsdc.pricePerShare()).to.equal(newPricePerShare);
      }

      // Executes checkAndToggleTrigger and verifies the expected state
      async function assertTriggerStatus(status: boolean) {
        await trigger.checkAndToggleTrigger();
        expect(await trigger.isTriggered()).to.equal(status);
      }

      // Read the trigger's tolerance
      const tolerance = (await trigger.tolerance()).toBigInt();

      // Increase share price to a larger value, should NOT be triggered (sanity check)
      await modifyLastPricePerShare(100n);
      await assertTriggerStatus(false);

      // Decrease share price by an amount less than tolerance, should NOT be triggered
      await modifyLastPricePerShare(tolerance - 1n);
      await assertTriggerStatus(false);

      // Decrease share price by an amount exactly equal to tolerance, should NOT be triggered
      await modifyLastPricePerShare(-tolerance);
      await assertTriggerStatus(false);

      // Decrease share price by an amount more than tolerance, should be triggered
      await modifyLastPricePerShare(-tolerance - 1n);
      await assertTriggerStatus(true);
    });
  });
});
