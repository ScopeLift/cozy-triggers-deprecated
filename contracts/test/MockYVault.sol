// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../interfaces/IYVault.sol";

/**
 * @notice Mock yVault, implemented the same way as a Yearn vault, but with configurable parameters for testing
 */
contract MockYVault is IYVault {
  uint256 public override pricePerShare;
  uint256 public underlyingDecimals = 6; // decimals of USDC underlying

  constructor() {
    // Initializing the values based on the yUSDC values on 2021-06-03
    pricePerShare = 1058448;
  }

  /**
   * @notice Set the pricePerShare
   * @param _pricePerShare New pricePerShare value
   */
  function set(uint256 _pricePerShare) external {
    pricePerShare = _pricePerShare;
  }
}
