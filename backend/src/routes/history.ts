import { Router, Request, Response } from 'express'

interface EtherscanLog {
  topics: string[]
  timeStamp: string
}

interface EtherscanResponse {
  status: string
  result: EtherscanLog[]
}

const router = Router()

const CONTRACT_ADDRESS = '0xD3966AD1E6A52Bdf23E2E2834a4e3b16f677bB5C'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

router.get('/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId as string)

    // Transfer event topic — keccak256 of Transfer(address,address,uint256)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    // tokenId as 32-byte hex (padded)
    const tokenIdHex = '0x' + tokenId.toString(16).padStart(64, '0')

    // const url = `https://api-sepolia.etherscan.io/api?module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&topic0=${transferTopic}&topic2=${tokenIdHex}&topic0_2_opr=and&fromBlock=11161387&toBlock=latest&page=1&offset=100&apikey=${process.env.ETHERSCAN_API_KEY}`
    const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&topic0=${transferTopic}&topic3=${tokenIdHex}&topic0_3_opr=and&fromBlock=11161387&toBlock=latest&page=1&offset=100&apikey=${process.env.ETHERSCAN_API_KEY}`
    // console.log('Fetching history from Etherscan:', url)
    const response = await fetch(url)
    const data = await response.json() as EtherscanResponse
    // console.log('Etherscan response:', data)
    if (data.status === '0') {
      res.json([])
      return
    }

    const history = data.result.map((log: any) => {
      const from = '0x' + log.topics[1].slice(26)
      const to = '0x' + log.topics[2].slice(26)
      const timestamp = parseInt(log.timeStamp, 16)
      const date = new Date(timestamp * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      const isMint = from.toLowerCase() === ZERO_ADDRESS

      return {
        from,
        to,
        date,
        type: isMint ? 'mint' : 'transfer',
      }
    })

    res.json(history)
  } catch (error) {
    console.error('Error fetching history:', error)
    res.status(500).json({ error: 'Failed to fetch ownership history' })
  }
})

export default router