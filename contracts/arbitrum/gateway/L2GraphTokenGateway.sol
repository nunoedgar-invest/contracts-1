// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../upgrades/GraphUpgradeable.sol";

/**
 * @title L2 Graph Token Gateway Contract
 * @dev Provides the L2 side of the Ethereum-Arbitrum GRT bridge. Receives GRT from the L1 chain
 * and mints them on the L2 side. Sending GRT back to L1 by burning them on the L2 side.
 */
contract L2GraphTokenGateway is GraphUpgradeable {
    using SafeMath for uint256;

    // TODO
}
