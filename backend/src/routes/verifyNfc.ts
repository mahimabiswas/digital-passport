import { Router, Request, Response } from 'express'

const router = Router()
const TAGTRUSTLINK_API_KEY = process.env.TAGTRUSTLINK_API_KEY
const TAGTRUSTLINK_TEMPLATE_UUID = process.env.TAGTRUSTLINK_TEMPLATE_UUID

router.get('/', async (req: Request, res: Response) => {
    const { picc, enc, cmac} = req.query

    if (!picc || !enc || !cmac) {
        res.status(400).json({ error: 'Missing required query parameters' })
        return
    }
    if (!TAGTRUSTLINK_API_KEY || !TAGTRUSTLINK_TEMPLATE_UUID) {
        res.status(500).json({ verified: false, error: 'Server misconfigured' })
        return
    }
    try{
        const response = await fetch(`https://www.tagtrustlink.com/api/validate/${TAGTRUSTLINK_API_KEY}/${TAGTRUSTLINK_TEMPLATE_UUID}?picc=${picc}&enc=${enc}&cmac=${cmac}`)
        const data : any = await response.json()
        if (!data.isValid) {
            res.json({ verified: false, error: data.errors?.[0] || 'Invalid tag' })
            return
        }
        res.json({ verified: true, uid: data.uid , readCounter: data.readCounter})

    } catch (err: any) {
        res.status(500).json({ verified: false, error: 'Verification failed' })
    }
})
export default router