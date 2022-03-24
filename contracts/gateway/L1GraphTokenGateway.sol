// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../upgrades/GraphUpgradeable.sol";
import "../arbitrum/ITokenGateway.sol";
import "../arbitrum/L1ArbitrumMessenger.sol";
import "../governance/Pausable.sol";
import "../governance/Managed.sol";

/**
 * @title L1 Graph Token Gateway Contract
 * @dev Provides the L1 side of the Ethereum-Arbitrum GRT bridge. Sends GRT to the L2 chain
 * by escrowing them and sending a message to the L2 gateway, and receives tokens from L2 by
 * releasing them from escrow. 
 */
contract L1GraphTokenGateway is GraphUpgradeable, Pausable, Managed, L1ArbitrumMessenger, ITokenGateway {
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
     * @notice Creates and sends a retryable ticket to transfer GRT to L2 using the Arbitrum Inbox.
     * The tokens are escrowed by the gateway until they are withdrawn back to L1.
     * The ticket must be redeemed on L2 to receive tokens at the specified address.
     * @dev maxGas and gasPriceBid must be set using Arbitrum's Inbox.estimateRetryableTicket method.
     * @param _l1Token L1 Address of the GRT contract
     * @param _to Recipient address on L2
     * @param _amount Amount of tokens to tranfer
     * @param _maxGas Gas limit for L2 execution of the ticket
     * @param _gasPriceBid Price per gas on L2
     * @param _data Encoded maxSubmissionCost and sender address along with additional calldata
     * @return Sequence number of the retryable ticket created by Inbox
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external override payable notPaused returns (bytes memory) {
        // TODO
    }

    /**
     * @notice Receives withdrawn tokens from L2
     * The equivalent tokens are released from escrow and sent to the destination.
     * @dev can only accept transactions coming from the L2 GRT Gateway
     * @param _l1Token L1 Address of the GRT contract
     * @param _from Address of the sender
     * @param _to Recepient address on L1
     * @param _amount Amount of tokens transferred
     * @param _data Contains exitNum which is always set to 0
     */
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external override payable notPaused {
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
