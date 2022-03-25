import { expect } from 'chai'
import { constants, utils } from 'ethers'

import { GraphToken } from '../../build/types/GraphToken'
import { L1GraphTokenGateway } from '../../build/types/L1GraphTokenGateway'

import { NetworkFixture } from '../lib/fixtures'

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
  let fixture: NetworkFixture

  let grt: GraphToken
  let l1GraphTokenGateway: L1GraphTokenGateway

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
    ;[me, governor, tokenSender, l2Receiver] = await getAccounts()

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

  })
})
