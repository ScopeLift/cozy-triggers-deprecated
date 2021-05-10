import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { MockCToken, CompoundInvariant } from '../typechain';

const { deployContract } = hre.waffle;

describe('CompoundInvariant', function () {
  let deployer: SignerWithAddress, recipient: SignerWithAddress;
  let mockCUsdc: MockCToken;
  let compoundInvariant: CompoundInvariant;

  before(async () => {
    [deployer, recipient] = await hre.ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy Mock CToken
    const mockCTokenArtifact = await hre.artifacts.readArtifact('MockCToken');
    mockCUsdc = <MockCToken>await deployContract(deployer, mockCTokenArtifact);

    // Deploy  CompoundInvariant trigger
    const triggerParams = [
      'Compound Invariant Trigger', // name
      'COMP-INV-TRIG', // symbol
      'Triggers when the Compound invariant that reserves + supply = cash + borrows is violated', // description
      [4], // platform ID for Compound
      recipient.address, // subsidy recipient
      mockCUsdc.address, // address of the Compound CToken market this trigger checks
    ];
    const compoundInvariantArtifact = await hre.artifacts.readArtifact('CompoundInvariant');
    compoundInvariant = <CompoundInvariant>await deployContract(deployer, compoundInvariantArtifact, triggerParams);
  });

  it('should deploy', async () => {
    expect(compoundInvariant.address).to.not.equal(ethers.constants.AddressZero);
  });
});
