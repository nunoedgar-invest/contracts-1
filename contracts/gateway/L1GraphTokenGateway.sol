// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../upgrades/GraphUpgradeable.sol";

/**
 * @title L1 Graph Token Gateway Contract
 * @dev Provides the L1 side of the Ethereum-Arbitrum GRT bridge. Sends GRT to the L2 chain
 * by escrowing them and sending a message to the L2 gateway, and receives tokens from L2 by
 * releasing them from escrow. 
 */
contract L1GraphTokenGateway is GraphUpgradeable {
    using SafeMath for uint256;

    // TODO
}
