// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../arbitrum/L2ArbitrumMessenger.sol";
import "../../gateway/GraphTokenGateway.sol";
import "../token/L2GraphToken.sol";

/**
 * @title L2 Graph Token Gateway Contract
 * @dev Provides the L2 side of the Ethereum-Arbitrum GRT bridge. Receives GRT from the L1 chain
 * and mints them on the L2 side. Sending GRT back to L1 by burning them on the L2 side.
 * Based on Offchain Labs' reference implementation and Livepeer's arbitrum-lpt-bridge
 * (See: https://github.com/OffchainLabs/arbitrum/tree/master/packages/arb-bridge-peripherals/contracts/tokenbridge
 * and https://github.com/livepeer/arbitrum-lpt-bridge)
 */
contract L2GraphTokenGateway is GraphTokenGateway, L2ArbitrumMessenger {
    using SafeMath for uint256;

    // Offset applied by the bridge to L1 addresses sending messages to L2
    uint160 internal constant L2_ADDRESS_OFFSET =
        uint160(0x1111000000000000000000000000000000001111);

    address public l1GRT;
    address public l1Counterpart;
    address public l2Router;

    struct OutboundCalldata {
        address from;
        bytes extraData;
    }

    event DepositFinalized(
        address indexed l1Token,
        address indexed _from,
        address indexed _to,
        uint256 _amount
    );

    event WithdrawalInitiated(
        address l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _l2ToL1Id,
        uint256 _exitNum,
        uint256 _amount
    );

    event L2RouterSet(address _l2Router);
    event L1TokenAddressSet(address _l1GRT);
    event L1CounterpartAddressSet(address _l1Counterpart);

    modifier onlyL1Counterpart() {
        require(
            msg.sender == L1ToL2Alias(l1Counterpart),
            "ONLY_COUNTERPART_GATEWAY"
        );
        _;
    }

    function setL2Router(address _l2Router) external onlyGovernor {
        l2Router = _l2Router;
        emit L2RouterSet(_l2Router);
    }

    function setL1TokenAddress(address _l1GRT) external onlyGovernor {
        l1GRT = _l1GRT;
        emit L1TokenAddressSet(_l1GRT);
    }

    function setL1CounterpartAddress(address _l1Counterpart) external onlyGovernor {
        l1Counterpart = _l1Counterpart;
        emit L1CounterpartAddressSet(_l1Counterpart);
    }

    /**
     * @notice Burns L2 tokens and initiates a transfer to L1.
     * The tokens will be received on L1 only after the wait period (7 days) is over,
     * and will require an Outbox.executeTransaction to finalize.
     * @dev no additional callhook data is allowed
     * @param _l1Token L1 Address of LPT
     * @param _to Recipient address on L1
     * @param _amount Amount of tokens to burn
     * @param _data Contains sender and additional data to send to L1
     * @return ID of the withdraw tx
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external returns (bytes memory) {
        return this.outboundTransfer(_l1Token, _to, _amount, 0, 0, _data);
    }

    /**
     * @notice Burns L2 tokens and initiates a transfer to L1.
     * The tokens will be available on L1 only after the wait period (7 days) is over,
     * and will require an Outbox.executeTransaction to finalize.
     * @dev no additional callhook data is allowed. The two unused params are needed
     * for compatibility with Arbitrum's gateway router.
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
        uint256, // unused on L2
        uint256, // unused on L2
        bytes calldata _data
    ) external override payable notPaused returns (bytes memory) {
        require(_l1Token == l1GRT, "TOKEN_NOT_GRT");
        require(_amount > 0, "INVALID_ZERO_AMOUNT");

        OutboundCalldata memory s;

        (s.from, s.extraData) = parseOutboundData(_data);
        require(s.extraData.length == 0, "CALL_HOOK_DATA_NOT_ALLOWED");

        // from needs to approve this contract to burn the amount first
        L2GraphToken(this.calculateL2TokenAddress(l1GRT)).bridgeBurn(s.from, _amount);

        uint256 id = sendTxToL1(
            0,
            s.from,
            l1Counterpart,
            getOutboundCalldata(_l1Token, s.from, _to, _amount, s.extraData)
        );

        // we don't need to track exitNums (b/c we have no fast exits) so we always use 0
        emit WithdrawalInitiated(_l1Token, s.from, _to, id, 0, _amount);

        return abi.encode(id);
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
    ) external override payable onlyL1Counterpart {
        require(_l1Token == l1GRT, "TOKEN_NOT_GRT");

        L2GraphToken(this.calculateL2TokenAddress(l1GRT)).bridgeMint(_to, _amount);

        emit DepositFinalized(_l1Token, _from, _to, _amount);
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
        return Managed._resolveContract(keccak256("GraphToken"));
    }

    /**
     * @notice Creates calldata required to send tx to L1
     * @dev encodes the target function with its params which
     * will be called on L1 when the message is received on L1
     */
    function getOutboundCalldata(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes memory data
    ) public pure returns (bytes memory outboundCalldata) {
        outboundCalldata = abi.encodeWithSelector(
            ITokenGateway.finalizeInboundTransfer.selector,
            token,
            from,
            to,
            amount,
            abi.encode(0, data) // we don't need to track exitNums (b/c we have no fast exits) so we always use 0
        );
    }

    /**
     * @notice Decodes calldata required for migration of tokens
     * @dev extraData can be left empty
     * @param data Encoded callhook data
     * @return from Sender of the tx
     * @return extraData Any other data sent to L1
     */
    function parseOutboundData(bytes memory data)
        private
        view
        returns (address from, bytes memory extraData)
    {
        if (msg.sender == l2Router) {
            (from, extraData) = abi.decode(data, (address, bytes));
        } else {
            from = msg.sender;
            extraData = data;
        }
    }

    /**
     * @notice Converts L1 address to its L2 alias used when sending messages
     * @dev The Arbitrum bridge adds an offset to addresses when sending messages,
     * so we need to apply it to check any L1 address from a message in L2
     * @param _l1Address The L1 address
     * @return _l2Address the L2 alias of _l1Address
     */
    function L1ToL2Alias(address _l1Address)
        internal
        pure
        returns (address _l2Address)
    {
        _l2Address = address(uint160(_l1Address) + L2_ADDRESS_OFFSET);
    }
}
