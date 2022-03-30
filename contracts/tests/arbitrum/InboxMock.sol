// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "../../arbitrum/IInbox.sol";

contract InboxMock is IInbox {
    uint8 internal constant L2_MSG = 3;
    uint8 internal constant L1MessageType_submitRetryableTx = 9;
    IBridge public override bridge;

    function sendL2Message(bytes calldata messageData) external override returns (uint256) {
        uint256 msgNum = deliverToBridge(L2_MSG, msg.sender, keccak256(messageData));
        emit InboxMessageDelivered(msgNum, messageData);
        return msgNum;
    }

    function setBridge(address _bridge) external {
        bridge = IBridge(_bridge);
    }

    function sendUnsignedTransaction(
        uint256,
        uint256,
        uint256,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (uint256) {
        revert("Unimplemented");
    }

    function sendContractTransaction(
        uint256,
        uint256,
        address,
        uint256,
        bytes calldata
    ) external  pure override returns (uint256) {
        revert("Unimplemented");
    }

    function sendL1FundedUnsignedTransaction(
        uint256,
        uint256,
        uint256,
        address,
        bytes calldata
    ) external payable override returns (uint256) {
        revert("Unimplemented");
    }

    function sendL1FundedContractTransaction(
        uint256,
        uint256,
        address,
        bytes calldata
    ) external payable override returns (uint256) {
        revert("Unimplemented");
    }

    uint160 constant offset = uint160(0x1111000000000000000000000000000000001111);

    /// @notice Utility function that converts the address in the L1 that submitted a tx to
    /// the inbox to the msg.sender viewed in the L2
    /// @param l1Address the address in the L1 that triggered the tx to L2
    /// @return l2Address L2 address as viewed in msg.sender
    function applyL1ToL2Alias(address l1Address) internal pure returns (address l2Address) {
        l2Address = address(uint160(l1Address) + offset);
    }

    function createRetryableTicket(
        address destAddr,
        uint256 arbTxCallValue,
        uint256 maxSubmissionCost,
        address submissionRefundAddress,
        address valueRefundAddress,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable override returns (uint256) {
        submissionRefundAddress = applyL1ToL2Alias(submissionRefundAddress);
        valueRefundAddress = applyL1ToL2Alias(valueRefundAddress);
        return
            _deliverMessage(
                L1MessageType_submitRetryableTx,
                msg.sender,
                abi.encodePacked(
                    uint256(uint160(bytes20(destAddr))),
                    arbTxCallValue,
                    msg.value,
                    maxSubmissionCost,
                    uint256(uint160(bytes20(submissionRefundAddress))),
                    uint256(uint160(bytes20(valueRefundAddress))),
                    maxGas,
                    gasPriceBid,
                    data.length,
                    data
                )
            );
    }

    function depositEth(uint256) external payable override returns (uint256) {
        revert("Unimplemented");
    }


    function pauseCreateRetryables() external pure override {
        revert("Unimplemented");
    }

    function unpauseCreateRetryables() external pure override {
        revert("Unimplemented");
    }

    function startRewriteAddress() external pure override {
        revert("Unimplemented");
    }

    function stopRewriteAddress() external pure override {
        revert("Unimplemented");
    }

    function _deliverMessage(
        uint8 _kind,
        address _sender,
        bytes memory _messageData
    ) internal returns (uint256) {
        uint256 msgNum = deliverToBridge(_kind, _sender, keccak256(_messageData));
        emit InboxMessageDelivered(msgNum, _messageData);
        return msgNum;
    }

    function deliverToBridge(
        uint8 kind,
        address sender,
        bytes32 messageDataHash
    ) internal returns (uint256) {
        return bridge.deliverMessageToInbox{ value: msg.value }(kind, sender, messageDataHash);
    }
}
