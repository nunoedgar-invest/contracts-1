// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "../../arbitrum/IBridge.sol";

contract BridgeMock is IBridge {

    address public inbox;
    address public outbox;
    uint256 public messageIndex;
    bytes32[] public override inboxAccs;

    function deliverMessageToInbox(
        uint8 kind,
        address sender,
        bytes32 messageDataHash
    ) external payable override returns (uint256) {
        messageIndex = messageIndex + 1;
        inboxAccs.push(keccak256(abi.encodePacked(inbox, kind, sender, messageDataHash)));
        emit MessageDelivered(messageIndex, inboxAccs[messageIndex], inbox, 0, msg.sender, messageDataHash);
        return messageIndex;
    }

    function executeCall(
        address destAddr,
        uint256 amount,
        bytes calldata data
    ) external override returns (bool success, bytes memory returnData) {
        require(outbox == msg.sender, "NOT_FROM_OUTBOX");

        (success, returnData) = destAddr.call{ value: amount }(data);
        emit BridgeCallTriggered(msg.sender, destAddr, amount, data);
    }

    // These are only callable by the admin
    function setInbox(address _inbox, bool enabled) external override {
        inbox = _inbox;
        emit InboxToggle(inbox, enabled);
    }

    function setOutbox(address _outbox, bool enabled) external override {
        outbox = _outbox;
        emit OutboxToggle(outbox, enabled);
    }

    // View functions

    function activeOutbox() external view override returns (address) {
        return outbox;
    }

    function allowedInboxes(address _inbox) external view override returns (bool) {
        return _inbox == inbox;
    }

    function allowedOutboxes(address _outbox) external view override returns (bool) {
        return _outbox == outbox;
    }

    function messageCount() external view override returns (uint256) {
        return messageIndex;
    }
}
