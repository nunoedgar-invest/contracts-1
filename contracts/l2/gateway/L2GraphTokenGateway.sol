// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../upgrades/GraphUpgradeable.sol";
import "../../arbitrum/ITokenGateway.sol";
import "../../arbitrum/L2ArbitrumMessenger.sol";
import "../../governance/Pausable.sol";
import "../../governance/Managed.sol";

/**
 * @title L2 Graph Token Gateway Contract
 * @dev Provides the L2 side of the Ethereum-Arbitrum GRT bridge. Receives GRT from the L1 chain
 * and mints them on the L2 side. Sending GRT back to L1 by burning them on the L2 side.
 * Based on Offchain Labs' reference implementation and Livepeer's arbitrum-lpt-bridge
 * (See: https://github.com/OffchainLabs/arbitrum/tree/master/packages/arb-bridge-peripherals/contracts/tokenbridge
  * and https://github.com/livepeer/arbitrum-lpt-bridge)
 */
contract L2GraphTokenGateway is GraphUpgradeable, Pausable, Managed, L2ArbitrumMessenger, ITokenGateway {
    using SafeMath for uint256;

    /**
     * @dev Override the default pausing from Managed to allow pausing this
     * particular contract besides pausing from the Controller.
     */
    function _notPaused() internal override view {
        require(!controller.paused(), "Paused (controller)");
        require(!_paused, "Paused (contract)");
    }

    /**
     * @notice Burns L2 tokens and initiates a transfer to L1.
     * The tokens will be available on L1 only after the wait period (7 days) is over,
     * and will require an Outbox.executeTransaction to finalize.
     * @dev no additional callhook data is allowed
     * @param _l1Token L1 Address of GRT
     * @param _to Recipient address on L1
     * @param _amount Amount of tokens to burn
     * @param _data Contains sender and additional data (always zero) to send to L1
     * @return ID of the withdraw transaction
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        uint256, // _maxGas, unused on L2
        uint256, // _gasPriceBid, unused on L2
        bytes calldata _data
    ) external override payable returns (bytes memory) {
        // TODO
    }

    /**
     * @notice Receives token amount from L1 and mints the equivalent tokens to the receiving address
     * @dev Only accepts transactions from the L1 GRT Gateway
     * data param is unused because no additional data is allowed from L1
     * @param _l1Token L1 Address of GRT
     * @param _from Address of the sender on L1
     * @param _to Recipient address on L2
     * @param _amount Amount of tokens transferred
     * @param _data Additional message data, unused
     */
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external override payable {
        // TODO
    }

    /**
     * @notice Calculate the L2 address of a bridged token
     * @dev In our case, this would only work for GRT.
     * @param l1ERC20 address of L1 GRT contract
     * @return L2 address of the bridged GRT token
     */
    function calculateL2TokenAddress(address l1ERC20) external override view returns (address) {
        // TODO
    }
}
