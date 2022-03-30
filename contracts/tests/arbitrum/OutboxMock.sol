// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "../../arbitrum/IOutbox.sol";
import "../../arbitrum/IBridge.sol";

contract OutboxMock is IOutbox {

    struct L2ToL1Context {
        uint128 l2Block;
        uint128 l1Block;
        uint128 timestamp;
        uint128 batchNum;
        bytes32 outputId;
        address sender;
    }
    L2ToL1Context internal context;

    IBridge public bridge;

    function setBridge(address _bridge) external {
        bridge = IBridge(_bridge);
    }

    function l2ToL1Sender() external view override returns (address) {
        return context.sender;
    }

    function l2ToL1Block() external view override returns (uint256) {
        return context.l2Block;
    }

    function l2ToL1EthBlock() external view override returns (uint256) {
        return context.l1Block;
    }

    function l2ToL1Timestamp() external view override returns (uint256) {
        return context.timestamp;
    }
    function l2ToL1BatchNum() external view override returns (uint256) {
        return context.batchNum;
    }

    function l2ToL1OutputId() external view override returns (bytes32) {
        return context.outputId;
    }

    function processOutgoingMessages(bytes calldata, uint256[] calldata)
        external override pure
    {
        revert("Unimplemented");
    }

    function outboxEntryExists(uint256) external override pure returns (bool) {
        return true;
    }

    /**
     * @notice (Mock) Executes a messages in an Outbox entry.
     * @dev This mocks what has to be called when finalizing an L2 to L1 transfer.
     * In our mock scenario, we don't validate and execute unconditionally.
     * @param batchNum Index of OutboxEntry in outboxEntries array
     * @param l2Sender sender of original message (i.e., caller of ArbSys.sendTxToL1)
     * @param destAddr destination address for L1 contract call
     * @param l2Block l2 block number at which sendTxToL1 call was made
     * @param l1Block l1 block number at which sendTxToL1 call was made
     * @param l2Timestamp l2 Timestamp at which sendTxToL1 call was made
     * @param amount value in L1 message in wei
     * @param calldataForL1 abi-encoded L1 message data
     */
    function executeTransaction(
        uint256 batchNum,
        bytes32[] calldata, // proof
        uint256, // index
        address l2Sender,
        address destAddr,
        uint256 l2Block,
        uint256 l1Block,
        uint256 l2Timestamp,
        uint256 amount,
        bytes calldata calldataForL1
    ) external virtual {
        bytes32 outputId;

        context = L2ToL1Context({
            sender: l2Sender,
            l2Block: uint128(l2Block),
            l1Block: uint128(l1Block),
            timestamp: uint128(l2Timestamp),
            batchNum: uint128(batchNum),
            outputId: outputId
        });

        // set and reset vars around execution so they remain valid during call
        executeBridgeCall(destAddr, amount, calldataForL1);
    }

    function executeBridgeCall(
        address destAddr,
        uint256 amount,
        bytes memory data
    ) internal {
        (bool success, bytes memory returndata) = bridge.executeCall(destAddr, amount, data);
        if (!success) {
            if (returndata.length > 0) {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("BRIDGE_CALL_FAILED");
            }
        }
    }
}
