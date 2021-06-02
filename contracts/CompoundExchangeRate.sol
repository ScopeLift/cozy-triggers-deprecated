// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./ICToken.sol";
import "./ITrigger.sol";

/**
 * @notice Defines a trigger that is toggled if the Compound invariant of reserves + supply = cash + borrows is violted
 * @dev To account for rounding error in the Compound Protocol, there is a margin of 0.000001% on this invariant
 */
contract CompoundExchangeRate is ITrigger {
  uint256 internal constant WAD = 10**18;

  /// @notice Market this trigger is for
  ICToken public immutable market;

  /// @dev At the time of writing this trigger, the invariant gave a result of 4464789529492704 != 4464789529492715,
  /// which is an error of ~2.5e-13%, due to rounding errors in Compound. To compensate for this rounding error, the
  /// trigger condition checks that the two values are within 0.000001% of each other
  uint256 public constant tolerance = WAD / 1000000; // 0.000001 = 1e-6

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

    // Verify market is not already triggered.
    // We pass in ICToken(_market) since immutable variables cannot be read during construction
    require(!isMarketTriggered(ICToken(_market)), "Market already triggered");
  }

  /**
   * @dev Checks the Compound Invariant that reserves + supply = cash + borrows
   * @param _market Market to check
   */
  function isMarketTriggered(ICToken _market) internal view returns (bool) {
    // Calculate the values of each side of the invariant. For totalSupply we convert units from cUSDC to USDC
    uint256 _totalSupply = (_market.totalSupply() * _market.exchangeRateStored()) / WAD; // adjusted total supply
    uint256 _lhs = _totalSupply + _market.totalReserves(); // left-hand side of invariant
    uint256 _rhs = _market.getCash() + _market.totalBorrows(); // right-hand side of invariant

    // Calculate the difference
    uint256 _diff = _lhs > _rhs ? _lhs - _rhs : _rhs - _lhs; // subtract the smaller value from the larger one
    uint256 _denominator = _lhs < _rhs ? _lhs : _rhs; // use smaller value as the denominator to be more conservative

    // Calculate the percent error
    uint256 _percent = (_diff * WAD) / _denominator;
    return _percent > tolerance;
  }

  /**
   * @notice Checks trigger condition, sets isTriggered flag to true if condition is met, and
   * returns the trigger status
   */
  function checkAndToggleTrigger() external override returns (bool) {
    // Short circuit if trigger already toggled
    if (isTriggered) return true;

    // Return false if market has not been triggered
    if (!isMarketTriggered(market)) return false;

    // Otherwise, market has been triggered
    emit TriggerActivated();
    isTriggered = true;
    return isTriggered;
  }
}
