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
     * @dev Check if the caller is the governor or pause guardian.
     */
    modifier onlyGovernorOrGuardian() {
        require(
            msg.sender == controller.getGovernor() || msg.sender == pauseGuardian,
            "Only Governor or Guardian can call"
        );
        _;
    }

    /**
     * @notice Change the Pause Guardian
     * @param _newPauseGuardian The address of the new Pause Guardian
     */
    function setPauseGuardian(address _newPauseGuardian) external onlyGovernor {
        require(_newPauseGuardian != address(0), "PauseGuardian must be set");
        _setPauseGuardian(_newPauseGuardian);
    }

    /**
     * @dev Override the default pausing from Managed to allow pausing this
     * particular contract instead of pausing from the Controller.
     */
    function _notPaused() internal override view {
        require(!_paused, "Paused (contract)");
    }

    /**
     * @notice Change the paused state of the contract
     */
    function setPaused(bool newPaused) external onlyGovernorOrGuardian {
        _setPaused(newPaused);
    }

    /**
     * @notice Getter to access paused
     */
    function paused() external view returns (bool) {
        return _paused;
    }
}
