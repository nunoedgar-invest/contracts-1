// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;
pragma abicoder v2;

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
 * Based on Offchain Labs' reference implementation and Livepeer's arbitrum-lpt-bridge
 * (See: https://github.com/OffchainLabs/arbitrum/tree/master/packages/arb-bridge-peripherals/contracts/tokenbridge
 * and https://github.com/livepeer/arbitrum-lpt-bridge)
 */
contract L1GraphTokenGateway is GraphUpgradeable, Pausable, Managed, L1ArbitrumMessenger, ITokenGateway {
    using SafeMath for uint256;

    // TODO add functions to properly manage all these
    address public l1GRT;
    address public l2GRT;
    address public inbox;
    address public l1Router;
    address public l2Counterpart;

    event DepositInitiated(
        address _l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _sequenceNumber,
        uint256 _amount
    );

    event WithdrawalFinalized(
        address _l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _exitNum,
        uint256 _amount
    );

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
        require(_l1Token == l1GRT, "TOKEN_NOT_GRT");
        require(_amount > 0, "INVALID_ZERO_AMOUNT");

        // nested scope to avoid stack too deep errors
        address from;
        uint256 seqNum;
        {
            bytes memory extraData;

            uint256 maxSubmissionCost;
            (from, maxSubmissionCost, extraData) = parseOutboundData(_data);
            require(extraData.length == 0, "CALL_HOOK_DATA_NOT_ALLOWED");

            // makes sure only sufficient ETH is supplied required for successful redemption on L2
            // if a user does not desire immediate redemption they should provide
            // a msg.value of AT LEAST maxSubmissionCost
            uint256 expectedEth = maxSubmissionCost + (_maxGas * _gasPriceBid);
            require(maxSubmissionCost > 0, "NO_SUBMISSION_COST");
            require(msg.value == expectedEth, "WRONG_ETH_VALUE");

            // transfer tokens to escrow
            IGraphToken(_l1Token).transferFrom(from, address(this), _amount);

            bytes memory outboundCalldata = getOutboundCalldata(
                _l1Token,
                from,
                _to,
                _amount,
                extraData
            );
            L2GasParams memory gasParams = L2GasParams(maxSubmissionCost, _maxGas, _gasPriceBid);
            seqNum = sendTxToL2(
                inbox,
                l2Counterpart,
                from,
                msg.value,
                0,
                gasParams,
                outboundCalldata
            );
        }
        emit DepositInitiated(_l1Token, from, _to, seqNum, _amount);

        return abi.encode(seqNum);
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
     * @notice decodes calldata required for migration of tokens
     * @dev data must include maxSubmissionCost, extraData can be left empty
     * @param data encoded callhook data
     * @return from sender of the tx
     * @return maxSubmissionCost base ether value required to keep retyrable ticket alive
     * @return extraData any other data sent to L2
     */
    function parseOutboundData(bytes memory data)
        private
        view
        returns (
            address from,
            uint256 maxSubmissionCost,
            bytes memory extraData
        )
    {
        if (msg.sender == l1Router) {
            // router encoded
            (from, extraData) = abi.decode(data, (address, bytes));
        } else {
            from = msg.sender;
            extraData = data;
        }
        // user encoded
        (maxSubmissionCost, extraData) = abi.decode(
            extraData,
            (uint256, bytes)
        );
    }

    /**
     * @notice Creates calldata required to create a retryable ticket
     * @dev encodes the target function with its params which
     * will be called on L2 when the retryable ticket is redeemed
     */
    function getOutboundCalldata(
        address l1Token,
        address from,
        address to,
        uint256 amount,
        bytes memory data
    ) public pure returns (bytes memory outboundCalldata) {
        bytes memory emptyBytes;

        outboundCalldata = abi.encodeWithSelector(
            ITokenGateway.finalizeInboundTransfer.selector,
            l1Token,
            from,
            to,
            amount,
            abi.encode(emptyBytes, data)
        );
    }

    /**
     * @notice Calculate the L2 address of a bridged token
     * @dev In our case, this would only work for GRT.
     * @param l1ERC20 address of L1 GRT contract
     * @return L2 address of the bridged GRT token
     */
    function calculateL2TokenAddress(address l1ERC20) external override view returns (address) {
        if (l1ERC20 != l1GRT) {
            return address(0);
        }
        return l2GRT;
    }
}
