import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import claimsFile from '../resources/gasRebates.json'
import fs from 'fs'

interface ClaimableAmount {
  [tokenAddress: string]: string
}

interface Network {
  [account: string]: ClaimableAmount[]
}

interface Claim {
  account: string
  tokenAddress: string
  amount: string
}
interface ClaimWithProof extends Claim {
  merkleProof: string[]
}

interface ClaimsPerNetwork {
  [network: string]: {
    merkleRoot: string
    accounts: ClaimWithProof[]
  }
}

const generateMerkleTree = (accounts: Network) => {
  const claims: string[][] = []

  // iterate through each account
  Object.keys(accounts).forEach((account) => {
    const claimableAmounts = accounts[account]

    claimableAmounts.forEach((claim: any) => {
      Object.entries(claim).forEach(([tokenAddress, amount]) => {
        claims.push([account, tokenAddress, String(amount)])
      })
    })
  })

  // create merkle tree and store tree root
  const tree = StandardMerkleTree.of(claims, ['address', 'address', 'uint256'])

  // make sure tree is valid
  tree.validate()

  return tree
}

const generateMerkleProof = (
  tree: StandardMerkleTree<string[]>,
  claim: Claim
) => {
  // iterate over all leafs in the tree and find the one matching the current claim
  for (const [i, v] of tree.entries()) {
    if (
      v[0] === claim.account &&
      v[1] === claim.tokenAddress &&
      v[2] === claim.amount
    ) {
      // find and return the merkle proof of the current claim
      return tree.getProof(i)
    }
  }
  throw Error('someting wong')
}

const processClaimsFile = (values: any) => {
  let merkleTree: StandardMerkleTree<string[]> = {} as StandardMerkleTree<
    string[]
  >
  const claimsWithProof: ClaimWithProof[] = []
  const output: ClaimsPerNetwork = {}

  // iterate through all networks
  Object.keys(values).forEach((network) => {
    const accounts: Network = values[network]

    // generate merkle tree for this network
    merkleTree = generateMerkleTree(accounts)
    if (!merkleTree) throw Error('Generation of merkle tree failed')

    // iterate over all accounts
    Object.keys(accounts).forEach((account) => {
      const claimableAmounts = accounts[account]

      // iterate over all claims (tokenAddress: amount)
      claimableAmounts.forEach((claim: any) => {
        Object.entries(claim).forEach(([tokenAddress, amount]) => {
          const currentClaim = {
            account: account,
            tokenAddress: tokenAddress,
            amount: String(amount),
          }

          // generate merkle proof for each account/tokenAddress/amount combination
          const merkleProof = generateMerkleProof(merkleTree, currentClaim)
          if (!merkleProof)
            console.error(
              `could not generate merkle proof for account: ${account}, tokenAddress: ${tokenAddress}, amount: ${amount}`
            )

          // add claim with proof to result array
          claimsWithProof.push({
            account: account,
            tokenAddress: tokenAddress,
            amount: String(amount),
            merkleProof,
          })
        })
      })
    })

    // add network entry with merkle root and all individual merkle proofs to output
    output[network] = {
      merkleRoot: merkleTree.root,
      accounts: claimsWithProof,
    }
  })

  // write formatted output to file
  fs.writeFileSync(
    './script/output/outputMerkleProofs.json',
    JSON.stringify(output, null, 2)
  )
}

const main = async () => {
  if (!claimsFile) throw Error('Input file invalid')

  // process input file and generate output JSON
  processClaimsFile(claimsFile)
}

main()
  .then(() => {
    console.log('Success')
    process.exit(0)
  })
  .catch((error) => {
    console.error('error')
    console.error(error)
    process.exit(1)
  })