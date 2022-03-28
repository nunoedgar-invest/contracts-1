// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "../upgrades/GraphUpgradeable.sol";
import "../arbitrum/ITokenGateway.sol";
import "../governance/Pausable.sol";
import "../governance/Managed.sol";

/**
 * @title L1/L2 Graph Token Gateway
 * @dev This includes everything that's shared between the L1 and L2 sides of the bridge.
 */
abstract contract GraphTokenGateway is GraphUpgradeable, Pausable, Managed, ITokenGateway, ReentrancyGuardUpgradeable {

    /**
     * @dev Override the default pausing from Managed to allow pausing this
     * particular contract besides pausing from the Controller.
     */
    function _notPaused() internal override view {
        require(!controller.paused(), "Paused (controller)");
        require(!_paused, "Paused (contract)");
    }
}
