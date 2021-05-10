import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { Artifact } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CompoundInvariant } from '../typechain/CompoundInvariant';

const { deployContract } = hre.waffle;

describe('Unit tests', function () {
  let signers: SignerWithAddress[];
  let compoundInvariant: CompoundInvariant;

  before(async function () {
    signers = await hre.ethers.getSigners();
  });

  describe('CompoundInvariant', function () {
    beforeEach(async () => {
      const greeterArtifact: Artifact = await hre.artifacts.readArtifact('CompoundInvariant');
      compoundInvariant = <CompoundInvariant>await deployContract(signers[0], greeterArtifact);
    });

    it('should deploy', async () => {
      expect(compoundInvariant.address).to.not.equal(ethers.constants.AddressZero);
    });
  });
});
