import { expect } from 'chai'
import { constants, utils } from 'ethers'

import { GraphToken } from '../../build/types/GraphToken'
import { BridgeMock } from '../../build/types/BridgeMock'
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
  let mockInbox: Account
  let mockRouter: Account
  let mockL2GRT: Account
  let mockL2Router: Account
  let fixture: NetworkFixture

  let grt: GraphToken
  let l1GraphTokenGateway: L1GraphTokenGateway
  let bridgeMock: BridgeMock

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
    ;[me, governor, tokenSender, l2Receiver, mockInbox, mockRouter, mockL2GRT, mockL2Router] = await getAccounts()

    fixture = new NetworkFixture()
    ;({ grt, l1GraphTokenGateway } = await fixture.load(governor.signer))

    // Give some funds to the indexer and approve staking contract to use funds on indexer behalf
    await grt.connect(governor.signer).mint(tokenSender.address, senderTokens)
    //await grt.connect(indexer.signer).approve(staking.address, indexerTokens)
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
      it('revert because it is paused', async function () {
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
          mockInbox.address,
          mockRouter.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets inbox and router address', async function () {
        const tx = l1GraphTokenGateway.connect(governor.signer).setArbitrumAddresses(
          mockInbox.address,
          mockRouter.address
        )
        await expect(tx).emit(l1GraphTokenGateway, 'ArbitrumAddressesSet')
          .withArgs(mockInbox.address, mockRouter.address)
        expect(await l1GraphTokenGateway.l1Router()).eq(mockRouter.address)
        expect(await l1GraphTokenGateway.inbox()).eq(mockInbox.address)
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
          mockL2Router.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets L2Counterpart', async function () {
        const tx = l1GraphTokenGateway.connect(governor.signer).setL2CounterpartAddress(
          mockL2Router.address
        )
        await expect(tx).emit(l1GraphTokenGateway, 'L2CounterpartAddressSet')
          .withArgs(mockL2Router.address)
        expect(await l1GraphTokenGateway.l2Counterpart()).eq(mockL2Router.address)
      })
    })
  })

  context('> after configuring and unpausing', function () {
    before(async function () {
      bridgeMock = (await deployContract(
        'BridgeMock',
        governor.signer,
      )) as unknown as BridgeMock
    })
  })
})
