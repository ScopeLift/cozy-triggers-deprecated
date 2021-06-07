// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./interfaces/IYVault.sol";
import "./interfaces/ITrigger.sol";

/**
 * @notice Defines a trigger that is toggled if the price per share for the yVault decreases between consecutive checks.
 * Under normal operation, this value should only increase
 */
contract YearnSharePrice is ITrigger {
  uint256 internal constant WAD = 10**18;

  /// @notice Vault this trigger is for
  IYVault public immutable market;

  /// @notice Last read exchangeRateStored
  uint256 public lastPricePerShare;

  /// @dev Due to potential rounding errors in the Yearn Protocol, the pricePerSare may occassionally decrease by a
  /// small amount even when nothing is wrong. A large, very conservative tolerance is applied to ensure we do not
  /// accidentally trigger in these cases. Even though a smaller tolerance would likely be ok, a non-trivial exploit
  ///  will most likely cause the pricePerSare to decrease by more than 10,000 wei
  uint256 public constant tolerance = 10000; // 10,000 wei tolerance

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _description,
    uint256[] memory _platformIds,
    address _recipient,
    address _market
  ) ITrigger(_name, _symbol, _description, _platformIds, _recipient) {
    // Set vault
    market = IYVault(_market);

    // Save current exchange rate (immutables can't be read at construction, so we don't use `market` directly)
    lastPricePerShare = IYVault(_market).pricePerShare();
  }

  /**
   * @dev Checks the yVault pricePerShare
   */
  function checkTriggerCondition() internal override returns (bool) {
    // Read this blocks exchange rate
    uint256 _currentPricePerShare = market.pricePerShare();

    // Check if current exchange rate is below current exchange rate, accounting for tolerance
    bool _status = _currentPricePerShare < (lastPricePerShare - tolerance);

    // Save the new exchange rate
    lastPricePerShare = _currentPricePerShare;

    // Return status
    return _status;
  }
}
