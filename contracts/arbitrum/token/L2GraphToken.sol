// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../upgrades/GraphUpgradeable.sol";
import "../../token/GraphToken.sol";

/**
 * @title L2 Graph Token Contract
 * @dev Provides the L2 version of the GRT token, meant to be minted/burned
 * through the L2GraphTokenGateway.
 */
contract L2GraphToken is GraphUpgradeable, GraphToken {
    using SafeMath for uint256;

    constructor(uint256 _initialSupply) GraphToken(_initialSupply) {

    }
}
