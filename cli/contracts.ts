import { BaseContract, providers, Signer } from 'ethers'

import { AddressBook } from './address-book'
import { logger } from './logging'
import { getContractAt } from './network'

import { EpochManager } from '../build/types/EpochManager'
import { DisputeManager } from '../build/types/DisputeManager'
import { Staking } from '../build/types/Staking'
import { ServiceRegistry } from '../build/types/ServiceRegistry'
import { Curation } from '../build/types/Curation'
import { RewardsManager } from '../build/types/RewardsManager'
import { GNS } from '../build/types/GNS'
import { GraphProxyAdmin } from '../build/types/GraphProxyAdmin'
import { GraphToken } from '../build/types/GraphToken'
import { Controller } from '../build/types/Controller'
import { BancorFormula } from '../build/types/BancorFormula'
import { IENS } from '../build/types/IENS'
import { IEthereumDIDRegistry } from '../build/types/IEthereumDIDRegistry'
import { GraphGovernance } from '../build/types/GraphGovernance'
import { L1GraphTokenGateway } from '../build/types/L1GraphTokenGateway'
import { L2GraphToken } from '../build/types/L2GraphToken'
import { L2GraphTokenGateway } from '../build/types/L2GraphTokenGateway'
import { providerNetworkIsL2 } from './utils'

export interface NetworkContracts {
  EpochManager: EpochManager
  DisputeManager: DisputeManager
  Staking: Staking
  ServiceRegistry: ServiceRegistry
  Curation: Curation
  RewardsManager: RewardsManager
  GNS: GNS
  GraphProxyAdmin: GraphProxyAdmin
  GraphToken: GraphToken
  Controller: Controller
  BancorFormula: BancorFormula
  IENS: IENS
  IEthereumDIDRegistry: IEthereumDIDRegistry
  GraphGovernance: GraphGovernance
  L1GraphTokenGateway: L1GraphTokenGateway
  L2GraphToken: L2GraphToken
  L2GraphTokenGateway: L2GraphTokenGateway
}

export const loadAddressBookContract = (
  contractName: string,
  addressBook: AddressBook,
  signerOrProvider?: Signer | providers.Provider,
): BaseContract => {
  const contractEntry = addressBook.getEntry(contractName)
  let contract = getContractAt(contractName, contractEntry.address)
  if (signerOrProvider) {
    contract = contract.connect(signerOrProvider)
  }
  return contract
}

export const loadContracts = (
  addressBook: AddressBook,
  signerOrProvider?: Signer | providers.Provider,
): NetworkContracts => {
  const contracts = {}
  for (const contractName of addressBook.listEntries()) {
    const contractEntry = addressBook.getEntry(contractName)
    try {
      contracts[contractName] = loadAddressBookContract(contractName, addressBook, signerOrProvider)
      // On L2 networks, we alias L2GraphToken as GraphToken
      if (signerOrProvider && providerNetworkIsL2(signerOrProvider) && contractName == 'L2GraphToken') {
        contracts['GraphToken'] = contracts[contractName]
      }
    } catch (err) {
      logger.warn(`Could not load contract ${contractName} - ${err.message}`)
    }
  }
  return contracts as NetworkContracts
}
