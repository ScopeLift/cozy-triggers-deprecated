// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IYVault {
  function pricePerShare() external view returns (uint256);
}
