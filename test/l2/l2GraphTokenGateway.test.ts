import { expect, use } from 'chai'
import { constants, Signer, utils } from 'ethers'

import { L2GraphToken } from '../../build/types/L2GraphToken'
import { L2GraphTokenGateway } from '../../build/types/L2GraphTokenGateway'

import { NetworkFixture } from '../lib/fixtures'

import { FakeContract, smock } from '@defi-wonderland/smock'

use(smock.matchers)

import {
  getAccounts,
  latestBlock,
  toBN,
  toGRT,
  Account,
} from '../lib/testHelpers'

const { AddressZero } = constants

describe('L2GraphTokenGateway', () => {
  let me: Account
  let governor: Account
  let tokenSender: Account
  let l1Receiver: Account
  let mockRouter: Account
  let mockL1GRT: Account
  let mockL1Gateway: Account
  let fixture: NetworkFixture
  let arbSysMock: FakeContract

  let grt: L2GraphToken
  let l2GraphTokenGateway: L2GraphTokenGateway

  const senderTokens = toGRT('1000')
  let eventsSetUp = false
  const defaultData = '0x';
  const notEmptyCallHookData = '0x12';
  const defaultDataWithNotEmptyCallHookData =
    utils.defaultAbiCoder.encode(
        ['bytes'],
        [notEmptyCallHookData],
    );

  before(async function () {
    ;[me, governor, tokenSender, l1Receiver, mockRouter, mockL1GRT, mockL1Gateway] = await getAccounts()

    fixture = new NetworkFixture()
    ;({ grt, l2GraphTokenGateway } = await fixture.loadL2(governor.signer))

    // Give some funds to the token sender
    await grt.connect(governor.signer).mint(tokenSender.address, senderTokens)
  })

  beforeEach(async function () {
    await fixture.setUp()
    // Thanks to Livepeer: https://github.com/livepeer/arbitrum-lpt-bridge/blob/main/test/unit/L2/l2LPTGateway.test.ts#L86
    arbSysMock = await smock.fake('ArbSys', {
        address: '0x0000000000000000000000000000000000000064',
    })
    if (!eventsSetUp) {
      arbSysMock.vm.on('afterMessage', (msg) => {
        if (msg.to == '0x0000000000000000000000000000000000000064') {
          console.log(msg)
        }
        
      })
      eventsSetUp = true
    }
    arbSysMock.sendTxToL1.returns(1)
  })

  afterEach(async function () {
    await fixture.tearDown()
  })

  context('> immediately after deploy', function () {
    describe('calculateL2TokenAddress', function () {
      it('should return the zero address', async function () {
        expect(await l2GraphTokenGateway.calculateL2TokenAddress(grt.address)).eq(AddressZero)
      })
    })

    describe('outboundTransfer', function () {
      it('reverts because it is paused', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer)["outboundTransfer(address,address,uint256,bytes)"](
          grt.address,
          l1Receiver.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('Paused (contract)')
      })
    })

    describe('finalizeInboundTransfer', function () {
      it('revert because it is paused', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer).finalizeInboundTransfer(
          grt.address,
          tokenSender.address,
          l1Receiver.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('Paused (contract)')
      })
    })

    describe('setL2Router', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer).setL2Router(
          mockRouter.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets router address', async function () {
        const tx = l2GraphTokenGateway.connect(governor.signer).setL2Router(
          mockRouter.address
        )
        await expect(tx).emit(l2GraphTokenGateway, 'L2RouterSet')
          .withArgs(mockRouter.address)
        expect(await l2GraphTokenGateway.l2Router()).eq(mockRouter.address)
      })
    })

    describe('setL1TokenAddress', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer).setL1TokenAddress(
          mockL1GRT.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets l2GRT', async function () {
        const tx = l2GraphTokenGateway.connect(governor.signer).setL1TokenAddress(
          mockL1GRT.address
        )
        await expect(tx).emit(l2GraphTokenGateway, 'L1TokenAddressSet')
          .withArgs(mockL1GRT.address)
        expect(await l2GraphTokenGateway.l1GRT()).eq(mockL1GRT.address)
      })
    })

    describe('setL1CounterpartAddress', function () {
      it('is not callable by addreses that are not the governor', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer).setL1CounterpartAddress(
          mockL1Gateway.address
        )
        await expect(tx).revertedWith('Caller must be Controller governor')
      })
      it('sets L1Counterpart', async function () {
        const tx = l2GraphTokenGateway.connect(governor.signer).setL1CounterpartAddress(
          mockL1Gateway.address
        )
        await expect(tx).emit(l2GraphTokenGateway, 'L1CounterpartAddressSet')
          .withArgs(mockL1Gateway.address)
        expect(await l2GraphTokenGateway.l1Counterpart()).eq(mockL1Gateway.address)
      })
    })
  })

  context('> after configuring and unpausing', function () {

    const testValidOutboundTransfer = async function(signer: Signer, data: string) {
      const tx = l2GraphTokenGateway.connect(signer)["outboundTransfer(address,address,uint256,bytes)"](
        mockL1GRT.address,
        l1Receiver.address,
        toGRT('10'),
        data
      )
      const expectedId = 1
      await expect(tx).emit(l2GraphTokenGateway, 'WithdrawalInitiated')
        .withArgs(mockL1GRT.address, tokenSender.address, l1Receiver.address, expectedId, 0, toGRT('10'))

      // Should use the L1 Gateway's interface, but both come from ITokenGateway
      const calldata = l2GraphTokenGateway.interface.encodeFunctionData('finalizeInboundTransfer',
        [
          mockL1GRT.address,
          tokenSender.address,
          l1Receiver.address,
          toGRT('10'),
          utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, []])
        ]
      )
      await expect(tx).emit(l2GraphTokenGateway, 'TxToL1')
        .withArgs(tokenSender.address, mockL1Gateway.address, 1, calldata)

      // For some reason the call count doesn't work properly,
      // and each function call is counted 12 times.
      // Possibly related to https://github.com/defi-wonderland/smock/issues/85 ?
      //expect(arbSysMock.sendTxToL1).to.have.been.calledOnce
      expect(arbSysMock.sendTxToL1).to.have.been.calledWith(
          mockL1Gateway.address,
          calldata,
      )
      const senderBalance = await grt.balanceOf(tokenSender.address)
      await expect(senderBalance).eq(toGRT('990'))
    }
    before(async function () {
      // Configure the L2 GRT
      // Configure the gateway
      await grt.connect(governor.signer).setGateway(
        l2GraphTokenGateway.address
      )
      await grt.connect(governor.signer).setL1Address(mockL1GRT.address)
      // Configure the gateway
      await l2GraphTokenGateway.connect(governor.signer).setL2Router(
        mockRouter.address
      )
      await l2GraphTokenGateway.connect(governor.signer).setL1TokenAddress(
        mockL1GRT.address
      )
      await l2GraphTokenGateway.connect(governor.signer).setL1CounterpartAddress(
        mockL1Gateway.address
      )
      await l2GraphTokenGateway.connect(governor.signer).setPaused(false)
    })

    describe('calculateL2TokenAddress', function () {
      it('returns the L2 token address', async function () {
        expect(await l2GraphTokenGateway.calculateL2TokenAddress(mockL1GRT.address)).eq(grt.address)
      })
      it('returns the zero address if the input is any other address', async function () {
        expect(await l2GraphTokenGateway.calculateL2TokenAddress(tokenSender.address)).eq(AddressZero)
      })
    })

    describe('outboundTransfer', function () {
      it('reverts when called with the wrong token address', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer)["outboundTransfer(address,address,uint256,bytes)"](
          tokenSender.address,
          l1Receiver.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('TOKEN_NOT_GRT')
      })
      it('burns tokens and triggers an L1 call', async function () {
        await grt.connect(tokenSender.signer).approve(l2GraphTokenGateway.address, toGRT('10'))
        await testValidOutboundTransfer(tokenSender.signer, defaultData)
      })
      it('decodes the sender address from messages sent by the router', async function () {
        await grt.connect(tokenSender.signer).approve(l2GraphTokenGateway.address, toGRT('10'))
        const routerEncodedData = utils.defaultAbiCoder.encode(
          ['address', 'bytes'],
          [tokenSender.address, defaultData],
        );
        await testValidOutboundTransfer(mockRouter.signer, routerEncodedData)
      })
      it('reverts when called with nonempty calldata', async function () {
        await grt.connect(tokenSender.signer).approve(l2GraphTokenGateway.address, toGRT('10'))
        const tx = l2GraphTokenGateway.connect(tokenSender.signer)["outboundTransfer(address,address,uint256,bytes)"](
          mockL1GRT.address,
          l1Receiver.address,
          toGRT('10'),
          defaultDataWithNotEmptyCallHookData
        )
        await expect(tx).revertedWith('CALL_HOOK_DATA_NOT_ALLOWED')
      })
      it('reverts when the sender does not have enough GRT', async function () {
        await grt.connect(tokenSender.signer).approve(l2GraphTokenGateway.address, toGRT('1001'))
        const tx = l2GraphTokenGateway.connect(tokenSender.signer)["outboundTransfer(address,address,uint256,bytes)"](
          mockL1GRT.address,
          l1Receiver.address,
          toGRT('1001'),
          defaultData
        )
        await expect(tx).revertedWith('ERC20: burn amount exceeds balance')
      })
    })

    describe('finalizeInboundTransfer', function () {
      it('reverts when called by an account that is not the gateway', async function () {
        const tx = l2GraphTokenGateway.connect(tokenSender.signer).finalizeInboundTransfer(
          mockL1GRT.address,
          l1Receiver.address,
          tokenSender.address,
          toGRT('10'),
          defaultData
        )
        await expect(tx).revertedWith('ONLY_COUNTERPART_GATEWAY')
      })
      
      it('mints and sends tokens') // TODO
    })
  })
})
