// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../ICToken.sol";
import "../ITrigger.sol";

/**
 * @notice Mock MockCozyToken, for testing the return value of checkAndToggleTrigger
 */

contract MockCozyToken {
  address public immutable trigger;
  bool public isTriggered;

  constructor(address _trigger) {
    trigger = _trigger;
  }

  /**
   * @notice Loosely mimics the implementation of a Cozy Token's checkAndToggleTriggerInternal method
   */
  function checkAndToggleTrigger() external {
    isTriggered = ITrigger(trigger).checkAndToggleTrigger();
  }
}
