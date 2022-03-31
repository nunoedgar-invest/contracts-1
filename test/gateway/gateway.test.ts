import { expect } from 'chai'
import { constants, Signer, utils } from 'ethers'

import { GraphToken } from '../../build/types/GraphToken'
import { BridgeMock } from '../../build/types/BridgeMock'
import { InboxMock } from '../../build/types/InboxMock'
import { OutboxMock } from '../../build/types/OutboxMock'
import { L1GraphTokenGateway } from '../../build/types/L1GraphTokenGateway'

import { NetworkFixture } from '../lib/fixtures'
import { deployContract } from '../lib/deployment'

import {
  advanceBlockTo,
  deriveChannelKey,
  getAccounts,
  randomHexBytes,
  latestBlock,
  toBN,
  toGRT,
  provider,
  Account,
} from '../lib/testHelpers'

const { AddressZero, MaxUint256 } = constants

describe('L1GraphTokenGateway', () => {
  let me: Account
  let governor: Account
  let tokenSender: Account
  let l2Receiver: Account
  let mockRouter: Account
  let mockL2GRT: Account
  let mockL2Gateway: Account
  let fixture: NetworkFixture

  let grt: GraphToken
  let l1GraphTokenGateway: L1GraphTokenGateway
  let bridgeMock: BridgeMock
  let inboxMock: InboxMock
  let outboxMock: OutboxMock

  const senderTokens = toGRT('1000')
  const maxGas = toBN('1000000')
  const maxSubmissionCost = toBN('7');
  const gasPriceBid = toBN('2');
  const defaultEthValue = maxSubmissionCost.add(maxGas.mul(gasPriceBid));
  const emptyCallHookData = '0x';
  const defaultData = utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [maxSubmissionCost, emptyCallHookData],
  );
  const notEmptyCallHookData = '0x12';
  const defaultDataWithNotEmptyCallHookData =
    utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [maxSubmissionCost, notEmptyCallHookData],
    );

  before(async function () {
    ;[me, governor, tokenSender, l2Receiver, mockRouter, mockL2GRT, mockL2Gateway] = await getAccounts()

    fixture = new NetworkFixture()
    ;({ grt, l1GraphTokenGateway } = await fixture.load(governor.signer))

    // Give some funds to the indexer and approve staking contract to use funds on indexer behalf
    await grt.connect(governor.signer).mint(tokenSender.address, senderTokens)
    //await grt.connect(indexer.signer).approve(staking.address, indexerTokens)
    bridgeMock = (await deployContract(
      'BridgeMock',
      governor.signer,
    )) as unknown as BridgeMock
    inboxMock = (await deployContract(
      'InboxMock',
      governor.signer,
    )) as unknown as InboxMock
    outboxMock = (await deployContract(
      'OutboxMock',
      governor.signer,
    )) as unknown as OutboxMock
  })

  beforeEach(async function () {
    await fixture.setUp()
  })

  afterEach(async function () {
    await fixture.tearDown()
  })

  context('> immediately after deploy', function () {
    describe('calculateL2TokenAddress', function () {
      it('should return address zero as it was not set', async function () {
        expect(await l1GraphTokenGateway.calculateL2TokenAddress(grt.address)).eq(AddressZero)
      })
    })

    describe('outboundTransfer', function () {
      it('reverts because it is paused', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).outboundTransfer(
          grt.address,
          l2Receiver.address,
          toGRT('10'),
          maxGas,
          gasPriceBid,
          defaultData,
          {
            value: defaultEthValue
          }
        )
        await expect(tx).revertedWith('Paused (contract)')
      })
    })

    describe('finalizeInboundTransfer', function () {
      it('revert because it is paused', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).finalizeInboundTransfer(
          grt.address,
          l2Receiver.address,
          tokenSender.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('Paused (contract)')
      })
    })

    describe('setArbitrumAddresses', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).setArbitrumAddresses(
          inboxMock.address,
          mockRouter.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets inbox and router address', async function () {
        const tx = l1GraphTokenGateway.connect(governor.signer).setArbitrumAddresses(
          inboxMock.address,
          mockRouter.address
        )
        await expect(tx).emit(l1GraphTokenGateway, 'ArbitrumAddressesSet')
          .withArgs(inboxMock.address, mockRouter.address)
        expect(await l1GraphTokenGateway.l1Router()).eq(mockRouter.address)
        expect(await l1GraphTokenGateway.inbox()).eq(inboxMock.address)
      })
    })

    describe('setL2TokenAddress', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).setL2TokenAddress(
          mockL2GRT.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets l2GRT', async function () {
        const tx = l1GraphTokenGateway.connect(governor.signer).setL2TokenAddress(
          mockL2GRT.address
        )
        await expect(tx).emit(l1GraphTokenGateway, 'L2TokenAddressSet')
          .withArgs(mockL2GRT.address)
        expect(await l1GraphTokenGateway.l2GRT()).eq(mockL2GRT.address)
      })
    })

    describe('setL2CounterpartAddress', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).setL2CounterpartAddress(
          mockL2Gateway.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets L2Counterpart', async function () {
        const tx = l1GraphTokenGateway.connect(governor.signer).setL2CounterpartAddress(
          mockL2Gateway.address
        )
        await expect(tx).emit(l1GraphTokenGateway, 'L2CounterpartAddressSet')
          .withArgs(mockL2Gateway.address)
        expect(await l1GraphTokenGateway.l2Counterpart()).eq(mockL2Gateway.address)
      })
    })
  })

  context('> after configuring and unpausing', function () {
    const createMsgData = function() {
      const selector = l1GraphTokenGateway.interface.getSighash('finalizeInboundTransfer')
      const params = utils.defaultAbiCoder.encode(
        ['address', 'address', 'address', 'uint256', 'bytes'],
        [grt.address, tokenSender.address, l2Receiver.address, toGRT('10'), utils.defaultAbiCoder.encode(
          ['bytes', 'bytes'],
          [emptyCallHookData, emptyCallHookData]
        )]
      )
      const outboundData = utils.hexlify(utils.concat([ selector, params ]))
      
      const offset = toBN('0x1111000000000000000000000000000000001111')
      let msgData = utils.solidityPack(
        [
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'bytes'
        ],
        [
          toBN(mockL2Gateway.address),
          toBN('0'),
          defaultEthValue,
          maxSubmissionCost,
          toBN(tokenSender.address).add(offset),
          toBN(tokenSender.address).add(offset),
          maxGas,
          gasPriceBid,
          utils.hexDataLength(outboundData),
          outboundData
        ]
      )
      return msgData
    }
    const createInboxAccsEntry = function(msgDataHash: string) {
      // The real bridge would emit the InboxAccs entry that came before this one, but our mock
      // emits this, making it easier for us to validate here that all the parameters we sent are correct
      let expectedInboxAccsEntry = utils.keccak256(utils.solidityPack(
        ['address', 'uint8', 'address', 'bytes32'],
        [inboxMock.address, 9, l1GraphTokenGateway.address, msgDataHash]
      ))
      return expectedInboxAccsEntry
    }
    const testValidOutboundTransfer = async function(signer: Signer, data: string) {
      const tx = l1GraphTokenGateway.connect(signer).outboundTransfer(
        grt.address,
        l2Receiver.address,
        toGRT('10'),
        maxGas,
        gasPriceBid,
        data,
        {
          value: defaultEthValue
        }
      )
      // Our bridge mock returns an incrementing seqNum starting at 1
      const expectedSeqNum = 1
      await expect(tx).emit(l1GraphTokenGateway, 'DepositInitiated')
        .withArgs(grt.address, tokenSender.address, l2Receiver.address, expectedSeqNum, toGRT('10'))

      
      let msgData = createMsgData()
      let msgDataHash = utils.keccak256(msgData)
      let expectedInboxAccsEntry = createInboxAccsEntry(msgDataHash)
      
      //expectedInboxAccsEntry = '0x0e287fa8d5351f12736c1d3819fd261831eaa7aea462720faf8bc018d6c0791e'
      await expect(tx).emit(inboxMock, 'InboxMessageDelivered')
        .withArgs(expectedSeqNum, msgData)
      await expect(tx).emit(bridgeMock, 'MessageDelivered')
        .withArgs(expectedSeqNum, expectedInboxAccsEntry, inboxMock.address, 9, l1GraphTokenGateway.address, msgDataHash)
      const escrowBalance = await grt.balanceOf(l1GraphTokenGateway.address)
      const senderBalance = await grt.balanceOf(tokenSender.address)
      await expect(escrowBalance).eq(toGRT('10'))
      await expect(senderBalance).eq(toGRT('990'))
    }
    before(async function () {
      // First configure the Arbitrum bridge mocks
      await bridgeMock.connect(governor.signer).setInbox(inboxMock.address, true)
      await bridgeMock.connect(governor.signer).setOutbox(outboxMock.address, true)
      await inboxMock.connect(governor.signer).setBridge(bridgeMock.address)
      await outboxMock.connect(governor.signer).setBridge(bridgeMock.address)

      // Configure the gateway
      await l1GraphTokenGateway.connect(governor.signer).setArbitrumAddresses(
        inboxMock.address,
        mockRouter.address
      )
      await l1GraphTokenGateway.connect(governor.signer).setL2TokenAddress(
        mockL2GRT.address
      )
      await l1GraphTokenGateway.connect(governor.signer).setL2CounterpartAddress(
        mockL2Gateway.address
      )
      await l1GraphTokenGateway.connect(governor.signer).setPaused(false)
    })

    describe('calculateL2TokenAddress', function () {
      it('returns the L2 token address', async function () {
        expect(await l1GraphTokenGateway.calculateL2TokenAddress(grt.address)).eq(mockL2GRT.address)
      })
      it('returns the zero address if the input is any other address', async function () {
        expect(await l1GraphTokenGateway.calculateL2TokenAddress(tokenSender.address)).eq(AddressZero)
      })
    })

    describe('outboundTransfer', function () {
      it('reverts when called with the wrong token address', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).outboundTransfer(
          tokenSender.address,
          l2Receiver.address,
          toGRT('10'),
          maxGas,
          gasPriceBid,
          defaultData,
          {
            value: defaultEthValue
          }
        )
        await expect(tx).revertedWith('TOKEN_NOT_GRT')
      })
      it('puts tokens in escrow and creates a retryable ticket', async function () {
        await grt.connect(tokenSender.signer).approve(l1GraphTokenGateway.address, toGRT('10'))
        await testValidOutboundTransfer(tokenSender.signer, defaultData)
      })
      it('decodes the sender address from messages sent by the router', async function () {
        await grt.connect(tokenSender.signer).approve(l1GraphTokenGateway.address, toGRT('10'))
        const routerEncodedData = utils.defaultAbiCoder.encode(
          ['address', 'bytes'],
          [tokenSender.address, defaultData],
        );
        await testValidOutboundTransfer(mockRouter.signer, routerEncodedData)
      })
      it('reverts when called with the wrong value', async function () {
        await grt.connect(tokenSender.signer).approve(l1GraphTokenGateway.address, toGRT('10'))
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).outboundTransfer(
          grt.address,
          l2Receiver.address,
          toGRT('10'),
          maxGas,
          gasPriceBid,
          defaultData,
          {
            value: defaultEthValue.add(1)
          }
        )
        await expect(tx).revertedWith('WRONG_ETH_VALUE')
      })
      it('reverts when the sender does not have enough GRT', async function () {
        await grt.connect(tokenSender.signer).approve(l1GraphTokenGateway.address, toGRT('1001'))
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).outboundTransfer(
          grt.address,
          l2Receiver.address,
          toGRT('1001'),
          maxGas,
          gasPriceBid,
          defaultData,
          {
            value: defaultEthValue
          }
        )
        await expect(tx).revertedWith('ERC20: transfer amount exceeds balance')
      })
    })

    describe('finalizeInboundTransfer', function () {
      it('reverts when called by an account that is not the bridge', async function () {
        const tx = l1GraphTokenGateway.connect(tokenSender.signer).finalizeInboundTransfer(
          grt.address,
          l2Receiver.address,
          tokenSender.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('NOT_FROM_BRIDGE')
      })
      it('reverts when called by the bridge, but the tx was not started by the L2 gateway', async function () {
        const encodedCalldata = l1GraphTokenGateway.interface.encodeFunctionData('finalizeInboundTransfer',
          [
            grt.address,
            l2Receiver.address,
            tokenSender.address,
            toGRT('10'),
            utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, []])
          ]
        )
        // The real outbox would require a proof, which would
        // validate that the tx was initiated by the L2 gateway but our mock
        // just executes unconditionally
        const tx = outboxMock.connect(tokenSender.signer).executeTransaction(
          toBN('0'),
          [],
          toBN('0'),
          l2Receiver.address, // Note this is not mockL2Gateway
          l1GraphTokenGateway.address,
          toBN('1337'),
          await latestBlock(),
          toBN('133701337'),
          toBN('0'),
          encodedCalldata
        )
        await expect(tx).revertedWith('ONLY_COUNTERPART_GATEWAY')
      })
      it('reverts if the gateway does not have tokens', async function () {
        // This scenario should never really happen, but we still
        // test that the gateway reverts in this case
        const encodedCalldata = l1GraphTokenGateway.interface.encodeFunctionData('finalizeInboundTransfer',
          [
            grt.address,
            l2Receiver.address,
            tokenSender.address,
            toGRT('10'),
            utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, []])
          ]
        )
        // The real outbox would require a proof, which would
        // validate that the tx was initiated by the L2 gateway but our mock
        // just executes unconditionally
        const tx = outboxMock.connect(tokenSender.signer).executeTransaction(
          toBN('0'),
          [],
          toBN('0'),
          mockL2Gateway.address,
          l1GraphTokenGateway.address,
          toBN('1337'),
          await latestBlock(),
          toBN('133701337'),
          toBN('0'),
          encodedCalldata
        )
        await expect(tx).revertedWith('BRIDGE_OUT_OF_FUNDS')
      })
      it('sends tokens out of escrow', async function () {
        await grt.connect(tokenSender.signer).approve(l1GraphTokenGateway.address, toGRT('10'))
        await testValidOutboundTransfer(tokenSender.signer, defaultData)
        // At this point, the gateway holds 10 GRT in escrow
        const encodedCalldata = l1GraphTokenGateway.interface.encodeFunctionData('finalizeInboundTransfer',
          [
            grt.address,
            l2Receiver.address,
            tokenSender.address,
            toGRT('8'),
            utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, []])
          ]
        )
        // The real outbox would require a proof, which would
        // validate that the tx was initiated by the L2 gateway but our mock
        // just executes unconditionally
        const tx = outboxMock.connect(tokenSender.signer).executeTransaction(
          toBN('0'),
          [],
          toBN('0'),
          mockL2Gateway.address,
          l1GraphTokenGateway.address,
          toBN('1337'),
          await latestBlock(),
          toBN('133701337'),
          toBN('0'),
          encodedCalldata
        )
        await expect(tx).emit(l1GraphTokenGateway, 'WithdrawalFinalized')
          .withArgs(grt.address, l2Receiver.address, tokenSender.address, toBN('0'), toGRT('8'))
        const escrowBalance = await grt.balanceOf(l1GraphTokenGateway.address)
        const senderBalance = await grt.balanceOf(tokenSender.address)
        await expect(escrowBalance).eq(toGRT('2'))
        await expect(senderBalance).eq(toGRT('998'))
      })
    })
  })
})
