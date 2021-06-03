// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./ICToken.sol";
import "./ITrigger.sol";

/**
 * @notice Defines a trigger that is toggled if the Compound exchange rate decreases between consecutive checks. Under
 * normal operation, this value should only increase
 */
contract CompoundExchangeRate is ITrigger {
  uint256 internal constant WAD = 10**18;

  /// @notice Market this trigger is for
  ICToken public immutable market;

  /// @notice Last read exchangeRateStored
  uint256 public lastExchangeRate;

  /// @dev Due to rounding errors in the Compound Protocol, the exchangeRateStored may occassionally decrease by small
  /// amount even when nothing is wrong. A tolerance is applied to ensure we do not accidentally trigger in these cases
  uint256 public constant tolerance = 100; // 100 wei tolerance

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _description,
    uint256[] memory _platformIds,
    address _recipient,
    address _market
  ) ITrigger(_name, _symbol, _description, _platformIds, _recipient) {
    // Set market
    market = ICToken(_market);

    // Save current exchange rate (immutables can't be read at construction, so we don't use `market` directly)
    lastExchangeRate = ICToken(_market).exchangeRateStored();
  }

  /**
   * @dev Checks the Compound Invariant that reserves + supply = cash + borrows
   */
  function isMarketTriggered() internal override returns (bool) {
    // Read this blocks exchange rate
    uint256 _currentExchangeRate = market.exchangeRateStored();

    // Check if current exchange rate is below current exchange rate, accounting for tolerance
    bool _status = _currentExchangeRate < (lastExchangeRate - tolerance);

    // Save the new exchange rate
    lastExchangeRate = _currentExchangeRate;

    // Return status
    return _status;
  }
}
