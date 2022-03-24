// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../upgrades/GraphUpgradeable.sol";
import "../../token/GraphToken.sol";
import "../../arbitrum/IArbToken.sol";

/**
 * @title L2 Graph Token Contract
 * @dev Provides the L2 version of the GRT token, meant to be minted/burned
 * through the L2GraphTokenGateway.
 */
contract L2GraphToken is GraphUpgradeable, GraphToken, IArbToken {
    using SafeMath for uint256;

    /**
     * @dev L2 Graph Token Contract Constructor.
     * @param _initialSupply Initial supply of GRT
     */
    constructor(uint256 _initialSupply) GraphToken(_initialSupply) {

    }

    /**
     * @dev Increases token supply, only callable by the L1 bridge.
     * @param account Address to credit with the new tokens
     * @param amount Number of tokens to mint
     */
    function bridgeMint(address account, uint256 amount) external override {
        // TODO
    }

    /**
     * @dev Decreases token supply, only callable by the L1 bridge.
     * @param account Address from which to extract the tokens
     * @param amount Number of tokens to burn
     */
    function bridgeBurn(address account, uint256 amount) external override {
        // TODO
    }

    /**
     * @dev Get the address of the L1 counterpart of this token
     * @return address of layer 1 token
     */
    function l1Address() external override view returns (address) {
        // TODO
    }

}
