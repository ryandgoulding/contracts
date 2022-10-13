import { AcrossFacet, ERC20__factory, DexManagerFacet } from '../../typechain'
import { deployments, network, ethers } from 'hardhat'
import { constants, utils } from 'ethers'
import { node_url } from '../../utils/network'
import approvedFunctionSelectors from '../../utils/approvedFunctions'

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const POLYGON_CHAIN_ID = 137
const ETH_WHALE_ADDR = '0xb5d85CBf7cB3EE0D56b3bB207D5Fc4B82f43F511'
const WETH_WHALE_ADDR = '0xD022510A3414f255150Aa54b2e42DB6129a20d9E'
const ZERO_ADDRESS = constants.AddressZero

describe('AcrossFacet', function () {
  let lifi: AcrossFacet
  let dexMgr: DexManagerFacet
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let owner: any
  let eth_whale: any
  let weth_whale: any
  let validBridgeData: any
  let usdc: any
  let weth: any
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (network.name != 'hardhat') {
    throw 'Only hardhat supported for testing'
  }

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      await deployments.fixture('DeployAcrossFacet')
      const diamond = await ethers.getContract('LiFiDiamond')
      lifi = <AcrossFacet>(
        await ethers.getContractAt('AcrossFacet', diamond.address)
      )
      dexMgr = <DexManagerFacet>(
        await ethers.getContractAt('DexManagerFacet', diamond.address)
      )
      // await dexMgr.addDex(UNISWAP_ADDRESS)
      await dexMgr.batchSetFunctionApprovalBySignature(
        approvedFunctionSelectors,
        true
      )

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ETH_WHALE_ADDR],
      })

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [WETH_WHALE_ADDR],
      })

      eth_whale = await ethers.getSigner(ETH_WHALE_ADDR)
      weth_whale = await ethers.getSigner(WETH_WHALE_ADDR)

      owner = await ethers.getSigners()
      owner = owner[0]

      weth = ERC20__factory.connect(WETH_ADDRESS, weth_whale)
      usdc = ERC20__factory.connect(USDC_ADDRESS, eth_whale)

      validBridgeData = {
        transactionId: utils.randomBytes(32),
        bridge: 'across',
        integrator: '',
        referrer: ZERO_ADDRESS,
        sendingAssetId: ZERO_ADDRESS,
        receiver: eth_whale.address,
        minAmount: utils.parseUnits('1000', 6).toString(),
        destinationChainId: POLYGON_CHAIN_ID,
        hasSourceSwaps: false,
        hasDestinationCall: false,
      }

      await weth.approve(lifi.address, 1000)
      await usdc.approve(lifi.address, 1000)
    }
  )

  before(async function () {
    this.timeout(0)
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: node_url('mainnet'),
            blockNumber: 15596007,
          },
        },
      ],
    })
  })

  beforeEach(async () => {
    await setupTest()
  })

  it('starts a bridge transaction on the sending chain for native token', async () => {
    const currentBlock = await ethers.provider.getBlockNumber()
    const now = (await ethers.provider.getBlock(currentBlock)).timestamp

    const AcrossData = {
      relayerFeePct: 0,
      quoteTimestamp: now,
    }

    await lifi
      .connect(eth_whale)
      .startBridgeTokensViaAcross(validBridgeData, AcrossData, {
        gasLimit: 500000,
        value: utils.parseUnits('1000', 6),
      })
  })

  it('starts a bridge transaction on the sending chain for WETH', async () => {
    const currentBLock = await ethers.provider.getBlockNumber()
    const now = (await ethers.provider.getBlock(currentBLock)).timestamp

    const bridgeData = {
      ...validBridgeData,
      sendingAssetId: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      minAmount: 1,
    }

    const AcrossData = {
      relayerFeePct: 0,
      quoteTimestamp: now,
    }

    await lifi
      .connect(weth_whale)
      .startBridgeTokensViaAcross(bridgeData, AcrossData, {
        gasLimit: 500000,
      })
  })
})